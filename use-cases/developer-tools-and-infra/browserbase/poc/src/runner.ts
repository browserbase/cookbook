import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";
import { classify, type PageSignals } from "./classify.js";
import { resolveModelKey, effectiveFeatures } from "./config.js";
import type { AttemptResult, Defaults, Features, Site } from "./types.js";
import { runBrowserTask } from "./../browser-task.js";

const REPLAY_BASE = "https://www.browserbase.com/sessions";

/** Build the Browserbase session create params from the resolved feature flags. */
function sessionParams(features: Features, region: string, projectId: string) {
  const browserSettings: Record<string, unknown> = {
    advancedStealth: features.advancedStealth,
    blockAds: features.blockAds,
    solveCaptchas: features.solveCaptchas,
  };
  // Geo-targeted residential proxies need the array form; plain `true` otherwise.
  let proxies: unknown = features.proxies;
  if (features.proxies && features.proxyCountry) {
    proxies = [
      { type: "browserbase", geolocation: { country: features.proxyCountry } },
    ];
  }
  return { projectId, region, proxies, browserSettings, keepAlive: false };
}

const GraderSchema = z.object({
  success: z
    .boolean()
    .describe("True only if the stated goal was clearly achieved."),
  blocked: z
    .boolean()
    .describe(
      "True if the page shows bot-detection, access-denied, or an unsolved CAPTCHA.",
    ),
  evidence: z.string().describe("One sentence of evidence for the judgment."),
});

async function captureSignals(page: any): Promise<PageSignals | undefined> {
  try {
    const [title, text] = await Promise.all([
      page.title().catch(() => ""),
      page
        .evaluate(() => (document.body?.innerText || "").slice(0, 4000))
        .catch(() => ""),
    ]);
    const url: unknown = await page.url();
    if (typeof url !== "string") return undefined;
    return { title, url, text };
  } catch {
    return undefined;
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | "__timeout__"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<"__timeout__">(resolve => { timer = setTimeout(() => resolve("__timeout__"), ms); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run ONE attempt against ONE site in a fresh session (= fresh proxy IP, which
 * is exactly the "retry to rotate the proxy" pattern CEs recommend).
 */
export async function runAttempt(
  site: Site,
  defaults: Defaults,
  attempt: number,
  siteId = "site-0",
): Promise<AttemptResult> {
  const start = Date.now();
  const name = site.name ?? new URL(site.url).hostname.replace(/^www\./, "");
  const features = effectiveFeatures(defaults.features, site.features);
  const expect = site.expect ?? site.task;
  const model = defaults.model;
  const modelKey = resolveModelKey(model)!;

  const base: Omit<AttemptResult, "outcome" | "success" | "reason"> = {
    siteId,
    site: name,
    url: site.url,
    attempt,
    durationMs: 0,
    features,
  };

  let stagehand: Stagehand | null = null;
  let browser: Awaited<ReturnType<typeof browserbase.launch>> | undefined;
  let attemptError: unknown;
  let sessionId: string | undefined;
  let replayUrl: string | undefined;
  let failureStage: AttemptResult["failureStage"] = "session_creation";
  try {
    browser = await browserbase.launch({
      apiKey: process.env.BROWSERBASE_API_KEY!,
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      ...(sessionParams(features, defaults.region, process.env.BROWSERBASE_PROJECT_ID!) as any),
    });
    sessionId = (browser as { sessionId?: string }).sessionId;
    replayUrl = sessionId ? `${REPLAY_BASE}/${sessionId}` : undefined;
    failureStage = "setup";
    stagehand = await Stagehand.create(
      StagehandCreateOptionsSchema.parse({
        browser,
        model: { modelName: model, apiKey: modelKey.key },
      }),
    );

    sessionId = (stagehand.browser.sessionId as string | undefined) ?? sessionId;
    replayUrl = sessionId ? `${REPLAY_BASE}/${sessionId}` : undefined;
    const page = (await stagehand.browser.context.activePage())!;

    // Drive the task, bounded by the per-attempt time budget.
    let timedOut = false;
    const work = (async () => {
      failureStage = "navigation";
      await page.goto(site.url, { waitUntil: "domcontentloaded" });
      failureStage = "task";
      const agent = (task: Parameters<typeof runBrowserTask>[1]) =>
        runBrowserTask(stagehand!, task, {});
      await agent({ instruction: site.task, maxSteps: defaults.maxSteps });
    })();

    const raced = await withTimeout(work, defaults.timeoutMs);
    if (raced === "__timeout__") timedOut = true;

    const signals = await captureSignals(page);

    failureStage = "grading";
    // Grade the result with the model (separate from the doing).
    let graderSuccess = false;
    let graderBlocked = false;
    try {
      const verdict = await withTimeout(
        stagehand
          .extract(
            `Goal: "${expect}".\n` +
              `Judge ONLY from the current page. Did the goal succeed? ` +
              `Set blocked=true if you see bot-detection, access-denied, or an unsolved CAPTCHA.`,
            GraderSchema,
            { page: page },
          )
          .then((result) => result.data),
        30_000,
      );
      if (verdict !== "__timeout__") {
        graderSuccess = verdict.success;
        graderBlocked = verdict.blocked;
      }
    } catch {
      /* grading failed; classifier falls back to page signals */
    }

    const { outcome, detected, reason } = classify({
      graderSuccess,
      graderBlocked,
      timedOut,
      errored: false,
      signals,
    });

    return {
      ...base,
      outcome,
      success: outcome === "pass",
      reason,
      detected,
      sessionId,
      replayUrl,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    attemptError = err;
    const message = (err as Error)?.message ?? String(err);
    // Make the enterprise-gating failure mode unmissable.
    const stealthGated = failureStage === "session_creation" &&
      /stealth|enterprise|not.*allowed|forbidden|plan/i.test(message) &&
      features.advancedStealth;
    return {
      ...base,
      outcome: "error",
      success: false,
      reason: stealthGated
        ? `Session failed — advanced stealth is Enterprise/Scale-plan only. Ask your Browserbase contact to enable it, or run with --preset baseline. (${message})`
        : `Session error: ${message}`,
      sessionId,
      replayUrl,
      failureStage,
      durationMs: Date.now() - start,
    };
  } finally {
    const cleanup = await Promise.allSettled([
      Promise.resolve().then(() => stagehand?.close()),
      Promise.resolve().then(() => browser?.close()),
    ]);
    const failures = cleanup.filter(result => result.status === "rejected").map(result => result.reason);
    if (failures.length) {
      throw new AggregateError(
        attemptError === undefined ? failures : [attemptError, ...failures],
        "Attempt cleanup failed",
      );
    }
  }
}
