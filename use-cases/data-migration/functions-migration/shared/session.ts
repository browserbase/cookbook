import Browserbase from "@browserbasehq/sdk";
import { chromium, type Browser, type Page } from "playwright-core";
import { BROWSERBASE_API_KEY } from "./config";

/**
 * Open the Platform A page on the RUNTIME-provided session (`ctx.session`).
 *
 * The function runtime auto-creates the session; we bind it to the customer's saved-login Browserbase
 * context per-invocation by passing `sessionCreateParams.browserSettings.context = { id, persist:false }`
 * in the invoke body (eng-confirmed; see DEV_NOTES). So here we just connect Playwright to
 * `ctx.session.connectUrl` — no second session. We still configure CDP download behavior so synthesized
 * CSV downloads sync to the Downloads API, and we hand back a Browserbase SDK client (from the customer's
 * apiKey) used only to poll/retrieve those downloads.
 */
export interface PlatformASession {
  bb: Browserbase;
  sessionId: string;
  browser: Browser;
  page: Page;
  close(): Promise<void>;
}

export async function openPlatformASession(
  ctx: { session: { id: string; connectUrl: string } },
  opts: { startUrl?: string } = {},
): Promise<PlatformASession> {
  const browser = await chromium.connectOverCDP(ctx.session.connectUrl);
  // Required so Playwright-over-CDP downloads sync to Browserbase storage (downloadPath MUST be "downloads").
  try {
    const cdp = await browser.newBrowserCDPSession();
    await cdp.send("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: "downloads",
      eventsEnabled: true,
    });
  } catch {
    // best-effort
  }
  const c = browser.contexts()[0]!;
  const page = c.pages()[0] ?? (await c.newPage());
  if (opts.startUrl) {
    await page.goto(opts.startUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
  }
  const bb = new Browserbase({ apiKey: BROWSERBASE_API_KEY });
  return {
    bb,
    sessionId: ctx.session.id,
    browser,
    page,
    // Only disconnect our CDP client; the runtime owns the session lifecycle.
    close: async () => {
      await browser.close().catch(() => {});
    },
  };
}
