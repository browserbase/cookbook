import { Browserbase } from "@browserbasehq/sdk";
import { browserbase, Stagehand, type Page, type StagehandBrowser } from "@browserbasehq/stagehand";
type StagehandInstance = Awaited<ReturnType<typeof Stagehand.create>>;
import type { AppConfig } from "./config.js";
import { CARD_AUTHORIZE_PATH, CARD_CHECKOUT_PATH, TEST_CARD_EXPIRY } from "./config.js";
import { createCardBrowserTokens, type EncryptedCard } from "./evervault.js";
import type { RunContext } from "./run-store.js";
import { DemoError } from "./sanitize.js";

export type CardRuntime = {
  launch: typeof browserbase.launch;
  attach: typeof Stagehand.create;
  tokens: typeof createCardBrowserTokens;
  debug(sessionId: string): Promise<{ debuggerFullscreenUrl: string }>;
  release(sessionId: string): Promise<unknown>;
  retrieve(sessionId: string): Promise<{ status: string }>;
};
export type CardRunOptions = {
  holdMs?: number;
  completionPollMs?: number;
  gateMs?: number;
  runtime?: CardRuntime;
};

const PRESENTER_GATE_MS = 45_000;
const TARGET_NAVIGATION_MS = 15_000;
const RESULT_POLL_MS = 15_000;

function targetUrl(config: AppConfig): string {
  if (!config.cardTargetHost) {
    throw new DemoError("CARD_TARGET_REQUIRED", "The synthetic merchant target is not configured");
  }
  return `https://${config.cardTargetHost}${CARD_CHECKOUT_PATH}`;
}

function isExpectedUrl(value: string, hostname: string, pathname: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === hostname && url.pathname === pathname;
  } catch {
    return false;
  }
}

function isRecoverableGotoTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message === "RPC response timed out: page.goto" ||
    /^waitForMainLoadState\(domcontentloaded\) timed out after \d+ms$/.test(error.message)
  );
}

async function navigateToCheckout(page: Page, config: AppConfig): Promise<void> {
  let recovered = false;
  try {
    await page.goto(targetUrl(config), {
      waitUntil: "domcontentloaded",
      timeout: TARGET_NAVIGATION_MS,
    });
  } catch (error) {
    if (!isRecoverableGotoTimeout(error)) throw error;
    recovered = true;
  }
  const ready = await page
    .waitForSelector("#mock-checkout", {
      state: "visible",
      timeout: TARGET_NAVIGATION_MS,
    })
    .catch(() => false);
  const finalUrl = await page.url().catch(() => "");
  if (!ready || !isExpectedUrl(finalUrl, config.cardTargetHost, CARD_CHECKOUT_PATH)) {
    throw new DemoError(
      recovered ? "CARD_TARGET_NAVIGATION_TIMEOUT" : "CARD_TARGET_UNAVAILABLE",
      "The synthetic merchant checkout did not become ready. Both sessions were released; try again.",
    );
  }
}

async function bounded<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Page state read timed out")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function waitForCardOutcome(
  page: Pick<Page, "evaluate">,
  hostname: string,
  expected: "approved" | "declined",
  timeoutMs = RESULT_POLL_MS,
): Promise<{ finalUrl: string; outcome: string }> {
  const deadline = Date.now() + timeoutMs;
  do {
    try {
      const snapshot = await bounded(
        page.evaluate(() => ({
          url: window.location.href,
          outcome:
            document.querySelector("#authorization-result")?.getAttribute("data-outcome") ?? "",
        })),
        Math.min(3_000, Math.max(1, deadline - Date.now())),
      );
      if (
        isExpectedUrl(snapshot.url, hostname, CARD_AUTHORIZE_PATH) &&
        snapshot.outcome === expected
      ) {
        return { finalUrl: snapshot.url, outcome: snapshot.outcome };
      }
    } catch {
      // A navigation can briefly invalidate the execution context; retry inside the bounded window.
    }
    if (Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 250));
  } while (Date.now() < deadline);
  throw new DemoError(
    expected === "approved" ? "CARD_APPROVAL_TIMEOUT" : "CARD_CONTROL_TIMEOUT",
    expected === "approved"
      ? "The synthetic merchant did not confirm approval in time. Both sessions were released; try again."
      : "The direct control did not reject the unchanged tokens in time. Both sessions were released; try again.",
  );
}

async function pollCompleted(
  runtime: CardRuntime,
  sessionId: string,
  timeoutMs: number,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const session = await runtime.retrieve(sessionId);
    if (session.status === "COMPLETED") return;
    if (session.status === "ERROR" || session.status === "TIMED_OUT") {
      throw new DemoError(
        "BROWSERBASE_CLEANUP_FAILED",
        `Browserbase ended with status ${session.status}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new DemoError(
    "BROWSERBASE_CLEANUP_TIMEOUT",
    "Browserbase did not report COMPLETED in time",
  );
}

async function showCardTokens(page: Page, numberToken: string, cvcToken: string): Promise<void> {
  await page.locator("#card-number").fill(numberToken);
  await page.locator("#card-expiry").fill(`${TEST_CARD_EXPIRY.month}/${TEST_CARD_EXPIRY.year}`);
  await page.locator("#card-cvc").fill(cvcToken);
}

async function submitCard(page: Page, numberToken: string, cvcToken: string): Promise<boolean> {
  return page.evaluate(
    ({ expectedNumber, expectedCvc, expectedExpiry }) => {
      const number = document.querySelector("#card-number");
      const cvc = document.querySelector("#card-cvc");
      const expiry = document.querySelector("#card-expiry");
      const form = document.querySelector("#mock-checkout");
      if (
        !(number instanceof HTMLInputElement) ||
        !(cvc instanceof HTMLInputElement) ||
        !(expiry instanceof HTMLInputElement) ||
        !(form instanceof HTMLFormElement) ||
        number.value !== expectedNumber ||
        cvc.value !== expectedCvc ||
        expiry.value !== expectedExpiry
      )
        return false;
      window.setTimeout(() => form.requestSubmit(), 0);
      return true;
    },
    {
      expectedNumber: numberToken,
      expectedCvc: cvcToken,
      expectedExpiry: `${TEST_CARD_EXPIRY.month}/${TEST_CARD_EXPIRY.year}`,
    },
  );
}

export async function executeCardRun(
  config: AppConfig,
  encryptedCard: EncryptedCard,
  context: RunContext,
  options: CardRunOptions = {},
): Promise<void> {
  const holdMs = options.holdMs ?? 30_000;
  const completionPollMs = options.completionPollMs ?? 30_000;
  const client = new Browserbase({
    apiKey: config.browserbaseApiKey,
    timeout: 10_000,
    maxRetries: 0,
  });
  const runtime: CardRuntime = options.runtime ?? {
    launch: (options) => browserbase.launch(options),
    attach: (options) => Stagehand.create(options),
    tokens: createCardBrowserTokens,
    debug: (id) => client.sessions.debug(id),
    release: (id) =>
      client.sessions.update(id, {
        status: "REQUEST_RELEASE",
      }),
    retrieve: (id) => client.sessions.retrieve(id),
  };
  let proxiedBrowser: StagehandBrowser | undefined;
  let controlBrowser: StagehandBrowser | undefined;
  let proxiedStagehand: StagehandInstance | undefined;
  let controlStagehand: StagehandInstance | undefined;
  let proxiedSessionId: string | undefined;
  let controlSessionId: string | undefined;
  let cleanupError: unknown;

  let closing: Promise<void> | undefined;
  const closeBothSessions = (): Promise<void> => {
    closing ??= closeResources();
    return closing;
  };
  const closeResources = async () => {
    const stagehands = [proxiedStagehand, controlStagehand].filter(
      (value): value is StagehandInstance => Boolean(value),
    );
    proxiedStagehand = undefined;
    controlStagehand = undefined;
    const stagehandResults = await Promise.allSettled(
      stagehands.map((stagehand) => stagehand.close()),
    );
    cleanupError ??= stagehandResults.find((result) => result.status === "rejected")?.reason;

    const browsers = [proxiedBrowser, controlBrowser].filter((value): value is StagehandBrowser =>
      Boolean(value && !value.closed),
    );
    proxiedBrowser = undefined;
    controlBrowser = undefined;
    const browserResults = await Promise.allSettled(browsers.map((browser) => browser.close()));
    cleanupError ??= browserResults.find((result) => result.status === "rejected")?.reason;
    // Also request release explicitly, including a partial launch or failed close.
    const releases = await Promise.allSettled(
      [proxiedSessionId, controlSessionId]
        .filter((id): id is string => Boolean(id))
        .map((id) => runtime.release(id)),
    );
    cleanupError ??= releases.find((result) => result.status === "rejected")?.reason;
  };

  context.setStopHook(closeBothSessions);
  try {
    if (context.isStopRequested()) return;
    context.update({ status: "running" });
    context.event("protect", "Creating five-minute card tokens with one exact destination");
    const tokens = await runtime.tokens(config, encryptedCard, config.cardTargetHost, {
      signal: context.signal,
    });
    encryptedCard.number = "";
    encryptedCard.cvc = "";
    const assertFresh = () => {
      if (Date.parse(tokens.expiresAt) - Date.now() < 15_000) {
        throw new DemoError(
          "BROWSER_TOKEN_EXPIRED",
          "Card tokens expired or are too close to expiry. Start a new comparison.",
        );
      }
    };
    context.update({ displayCardTokens: { number: tokens.numberToken, cvc: tokens.cvcToken } });
    if (Date.parse(tokens.expiresAt) - Date.now() < 60_000) {
      throw new DemoError(
        "BROWSER_TOKEN_TOO_SHORT",
        "Browser Tokens have less than 60 seconds remaining",
      );
    }
    if (context.isStopRequested()) {
      context.update({ status: "stopped" });
      return;
    }

    context.event(
      "execute",
      "Launching matched Browserbase sessions with and without Evervault's proxy",
    );
    const sharedBrowserSettings = {
      allowedDomains: [config.cardTargetHost],
      ignoreCertificateErrors: false,
      recordSession: false,
      logSession: false,
      solveCaptchas: false,
      advancedStealth: false,
      verified: false,
      viewport: { width: 1280, height: 900 },
    };
    const launchResults = await Promise.allSettled([
      runtime.launch({
        apiKey: config.browserbaseApiKey,
        api_timeout: 240,
        keepAlive: false,
        region: "us-east-1",
        proxies: [
          {
            type: "external",
            server: `https://${tokens.proxy.hostname}:${tokens.proxy.port}`,
            username: tokens.proxy.username,
            password: tokens.proxy.password,
          },
        ],
        proxySettings: { caCertificates: [config.caCertificateId] },
        browserSettings: sharedBrowserSettings,
        userMetadata: {
          demo: "evervault-browser-tokens-card",
          path: "evervault-proxy",
          runId: context.runId,
        },
      }),
      runtime.launch({
        apiKey: config.browserbaseApiKey,
        api_timeout: 240,
        keepAlive: false,
        region: "us-east-1",
        browserSettings: sharedBrowserSettings,
        userMetadata: {
          demo: "evervault-browser-tokens-card",
          path: "direct-control",
          runId: context.runId,
        },
      }),
    ]);
    if (launchResults[0].status === "fulfilled") proxiedBrowser = launchResults[0].value;
    if (launchResults[1].status === "fulfilled") controlBrowser = launchResults[1].value;
    proxiedSessionId = proxiedBrowser?.sessionId;
    controlSessionId = controlBrowser?.sessionId;
    // Stop may arrive during launch. Close the resources that arrived afterward.
    closing = undefined;
    if (context.isStopRequested()) {
      context.update({ status: "stopped" });
      return;
    }
    if (!proxiedBrowser || !controlBrowser) {
      throw new DemoError(
        "SESSION_LAUNCH_FAILED",
        "Both card comparison sessions could not be launched. Any active session will be released.",
      );
    }
    proxiedSessionId = proxiedBrowser.sessionId;
    controlSessionId = controlBrowser.sessionId;
    if (!proxiedSessionId || !controlSessionId) {
      throw new DemoError(
        "SESSION_ID_MISSING",
        "A Browserbase comparison session ID is unavailable",
      );
    }

    const [proxiedLive, controlLive] = await Promise.all([
      runtime.debug(proxiedSessionId),
      runtime.debug(controlSessionId),
    ]);
    context.update({
      proxiedLiveViewUrl: proxiedLive.debuggerFullscreenUrl,
      controlLiveViewUrl: controlLive.debuggerFullscreenUrl,
    });

    if (context.isStopRequested()) {
      context.update({ status: "stopped" });
      return;
    }
    const stagehandResults = await Promise.allSettled([
      runtime.attach({ browser: proxiedBrowser, logging: { level: "off" } }),
      runtime.attach({ browser: controlBrowser, logging: { level: "off" } }),
    ]);
    if (stagehandResults[0].status === "fulfilled") proxiedStagehand = stagehandResults[0].value;
    if (stagehandResults[1].status === "fulfilled") controlStagehand = stagehandResults[1].value;
    closing = undefined;
    if (!proxiedStagehand || !controlStagehand) {
      throw new DemoError(
        "STAGEHAND_ATTACH_FAILED",
        "Both card comparison sessions could not be attached. Any active session will be released.",
      );
    }

    // Stop can arrive during attachment; the finalizer must close late attachments.
    closing = undefined;
    if (context.isStopRequested()) {
      context.update({ status: "stopped" });
      return;
    }

    const [proxiedPage, controlPage] = await Promise.all([
      proxiedBrowser.context.activePage().then((page) => page ?? proxiedBrowser!.context.newPage()),
      controlBrowser.context.activePage().then((page) => page ?? controlBrowser!.context.newPage()),
    ]);
    await Promise.all([
      navigateToCheckout(proxiedPage, config),
      navigateToCheckout(controlPage, config),
    ]);

    context.event(
      "execute",
      "Both synthetic checkouts are ready; compare the same card tokens in each browser",
    );
    const enterResult = await context.waitForAdvance(
      "enter_token",
      options.gateMs ?? PRESENTER_GATE_MS,
    );
    if (enterResult !== "advanced") {
      context.update({ status: "stopped" });
      context.event(
        "cleanup",
        enterResult === "timed_out"
          ? "Presenter checkpoint timed out; releasing both sessions safely"
          : "Presenter stopped both sessions",
      );
      return;
    }

    assertFresh();
    if (context.isStopRequested()) return;
    await Promise.all([
      showCardTokens(proxiedPage, tokens.numberToken, tokens.cvcToken),
      showCardTokens(controlPage, tokens.numberToken, tokens.cvcToken),
    ]);
    context.event(
      "execute",
      "The same PAN and CVC tokens are visible in both browsers; submit both to compare network paths",
    );
    const submitResult = await context.waitForAdvance(
      "submit_token",
      options.gateMs ?? PRESENTER_GATE_MS,
    );
    if (submitResult !== "advanced") {
      context.update({ status: "stopped" });
      context.event(
        "cleanup",
        submitResult === "timed_out"
          ? "Presenter checkpoint timed out; releasing both sessions safely"
          : "Presenter stopped both sessions",
      );
      return;
    }

    assertFresh();
    if (context.isStopRequested()) return;
    context.event("execute", "Submitting the same verified card tokens through both network paths");
    const submitted = await Promise.all([
      submitCard(proxiedPage, tokens.numberToken, tokens.cvcToken),
      submitCard(controlPage, tokens.numberToken, tokens.cvcToken),
    ]);
    if (submitted.some((value) => !value)) {
      throw new DemoError(
        "TOKEN_DOM_ASSERTION_FAILED",
        "Both checkouts did not contain the expected card tokens",
      );
    }
    await Promise.all([
      waitForCardOutcome(proxiedPage, config.cardTargetHost, "approved"),
      waitForCardOutcome(controlPage, config.cardTargetHost, "declined"),
    ]);
    context.update({
      proxiedOutcome: "approved",
      controlOutcome: "rejected_as_expected",
      status: "holding",
    });
    context.event(
      "success",
      `Same card tokens, different result: the proxied checkout was approved and the direct control was declined. Both close in ${Math.ceil(holdMs / 1000)} seconds`,
    );
    await context.wait(holdMs);
    context.update({ status: context.isStopRequested() ? "stopped" : "succeeded" });
  } finally {
    encryptedCard.number = "";
    encryptedCard.cvc = "";
    context.update({ cleanupStatus: "releasing" });
    context.event("cleanup", "Releasing both Browserbase sessions");
    await closeBothSessions();
    const completionResults = await Promise.allSettled([
      ...(proxiedSessionId ? [pollCompleted(runtime, proxiedSessionId, completionPollMs)] : []),
      ...(controlSessionId ? [pollCompleted(runtime, controlSessionId, completionPollMs)] : []),
    ]);
    cleanupError ??= completionResults.find((result) => result.status === "rejected")?.reason;
    context.update({
      cleanupStatus: cleanupError ? "failed" : "completed",
      proxiedLiveViewUrl: undefined,
      controlLiveViewUrl: undefined,
      displayCardTokens: undefined,
    });
    context.event(
      "cleanup",
      cleanupError
        ? "Session release could not be confirmed"
        : "All launched Browserbase sessions are COMPLETED",
    );
    if (cleanupError)
      throw new DemoError(
        "BROWSERBASE_CLEANUP_FAILED",
        "Session cleanup could not be confirmed. Check your Browserbase dashboard before starting another run.",
      );
  }
}
