import Browserbase from "@browserbasehq/sdk";
import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { chromium, type Browser, type Page } from "playwright-core";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { CONFIG, requireEnv, type Country } from "./config";
import { proxiesForCountry } from "./proxyGeo";

// Keep the managed Model-Gateway "no LLM key needed" story intact for Process 1:
// Stagehand otherwise auto-loads any provider key from the shell and forwards it,
// which would silently override the gateway path. (Pattern: walmart/kyb-parallel.ts)
for (const k of [
  "GOOGLE_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
]) {
  delete process.env[k];
}

export interface ManagedSession {
  /** Stagehand owns the Browserbase session (stealth + proxy). Used for Process 1
   *  (act/observe/extract). In Process 2 it just holds the session open. */
  stagehand: Stagehand;
  /** Raw Playwright page over CDP — the ONLY reliable way to intercept network
   *  responses / listen for CAPTCHA console events on a Browserbase session, since
   *  Stagehand v3's CDP-native page does not expose page.on('response')/page.route. */
  pwPage: Page;
  pwBrowser: Browser;
  sessionId: string;
  liveViewUrl: string;
  close: () => Promise<void>;
}

/**
 * Create a fully stealthed, country-geolocated Browserbase session and attach a
 * raw Playwright page to it for network capture.
 *
 * `cityPrecision=false` falls back to country-only proxy routing (use it if a
 * metro's proxy pool is exhausted — see proxyGeo.ts).
 */
export interface SessionOpts {
  cityPrecision?: boolean;
  /** Attach a persisted Browserbase Context (e.g. a logged-in Shopee session). */
  contextId?: string;
  /** Write cookie/storage changes back to the Context on close (login bootstrap). */
  persist?: boolean;
  /** Max session lifetime (seconds). Raise it for interactive login bootstrap. */
  timeoutSec?: number;
}

export async function createSession(
  country: Country,
  opts: SessionOpts = {},
): Promise<ManagedSession> {
  requireEnv();
  const cityPrecision = opts.cityPrecision ?? true;

  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await browserbase.launch({
        apiKey: process.env.BROWSERBASE_API_KEY!,
        ...{
          projectId: CONFIG.projectId,
          region: CONFIG.region,
          // Server-side lifetime cap. Without it a wedged/orphaned session bills until
          // the project default (15 min); explicit opts.timeoutSec (login bootstrap)
          // still wins over the CONFIG backstop.
          api_timeout: opts.timeoutSec ?? CONFIG.sessionTimeoutSec,
          // Residential proxy pinned to the target country's metro — this is the
          // exit IP the e-commerce site geo-checks.
          proxies: proxiesForCountry(country, cityPrecision),
          browserSettings: {
            // `verified` = Browserbase's managed advanced-stealth Chromium with real
            // fingerprints recognized by its bot-protection partners (Scale plan).
            verified: true,
            // CAPTCHA auto-solving is on by default; set explicitly for clarity.
            solveCaptchas: true,
            // Cuts bandwidth (the dominant cost at scale) and removes ad noise.
            blockAds: true,
            viewport: { width: 1366, height: 768 },
            os: "mac",
            // Reuse a logged-in session (Process 1 category browse needs auth on Shopee).
            ...(opts.contextId
              ? {
                  context: {
                    id: opts.contextId,
                    persist: opts.persist ?? false,
                  },
                }
              : {}),
          },
        },
      }),
      model: {
        modelName: process.env.STAGEHAND_MODEL ?? "google/gemini-2.5-flash",
      },
    }),
  );

  const sessionId = stagehand.browser.sessionId!;
  const liveViewUrl = (
    await new Browserbase({
      apiKey: process.env.BROWSERBASE_API_KEY,
    }).sessions.debug(stagehand.browser.sessionId!)
  ).debuggerFullscreenUrl;

  // Attach a second, passive CDP client (raw Playwright) to the SAME session.
  const connectUrl = stagehand.rpcClient?.browserWebSocketDebuggerUrl;
  if (!connectUrl)
    throw new Error("Stagehand did not expose the browser CDP endpoint");
  const pwBrowser = await chromium.connectOverCDP(connectUrl);
  const pwContext = pwBrowser.contexts()[0] ?? (await pwBrowser.newContext());
  const pwPage = pwContext.pages()[0] ?? (await pwContext.newPage());

  return {
    stagehand,
    pwPage,
    pwBrowser,
    sessionId,
    liveViewUrl,
    close: async () => {
      // Disconnect our CDP client first, then end the Browserbase session.
      await pwBrowser.close().catch(() => {});
      await stagehand.close().catch(() => {});
    },
  };
}

/**
 * Resolve a CDP websocket URL for the Stagehand-owned session. Prefer Stagehand's
 * own accessor (name varies across v3 minors); fall back to the documented
 * Browserbase connect-URL format. If the side-channel ever fails to attach, this
 * is the first place to check against your installed Stagehand version.
 */
