import { chromium, type Browser, type Page } from "playwright";
import { execFileSync } from "node:child_process";

export interface BbSession {
  wssUrl: string;
  sessionId: string;
}

export function createBrowserbaseSession(): BbSession | null {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!apiKey || !projectId) return null;

  // Verified mode + residential proxies + captcha solver. The new browse CLI
  // (replaces bb). Verified mode is required to clear Akamai-style bot
  // protection on .ca.gov-class sites.
  // --keep-alive: session survives between autobrowse subprocess invocations
  //   (without it, Browserbase auto-closes when the last CDP client disconnects,
  //   which is what happens between Phase 1 evaluate.mjs exit and Phase 2 spawn).
  let stdout: string;
  try {
    stdout = execFileSync(
    "browse",
    [
      "cloud",
      "sessions",
      "create",
      "--proxies",
      "--verified",
      "--solve-captchas",
      "--keep-alive",
    ],
    { encoding: "utf-8" },
    );
  } catch {
    throw new Error("Browserbase session creation failed");
  }
  const session = parseJsonAfterPreamble(stdout);
  if (!session?.id) {
    throw new Error(
      "browse cloud sessions create returned no session id",
    );
  }
  // Prefer the connectUrl from the response (carries a signingKey); fall back
  // to the legacy apiKey-based URL.
  const wssUrl =
    session.connectUrl ??
    `wss://connect.browserbase.com?apiKey=${apiKey}&sessionId=${session.id}`;
  return { wssUrl, sessionId: session.id };
}

export function releaseBrowserbaseSession(bb: BbSession): void {
  try {
    execFileSync(
      "browse",
      [
        "cloud",
        "sessions",
        "update",
        bb.sessionId,
        "--status",
        "REQUEST_RELEASE",
      ],
      { stdio: "ignore" },
    );
  } catch {
    /* best-effort */
  }
}

// The browse CLI prints an "Update available" notice to stdout before the JSON.
// Find the first `{` and parse from there.
function parseJsonAfterPreamble(s: string): {
  id?: string;
  connectUrl?: string;
} {
  const idx = s.indexOf("{");
  if (idx === -1) return {};
  try {
    return JSON.parse(s.slice(idx));
  } catch {
    return {};
  }
}

export async function connect(
  bb: BbSession | null,
): Promise<{ browser: Browser; page: Page }> {
  const browser = bb
    ? await chromium.connectOverCDP(bb.wssUrl)
    : await chromium.launch({ headless: false });
  const context = bb ? browser.contexts()[0] : await browser.newContext();
  const page = context.pages()[0] ?? (await context.newPage());
  return { browser, page };
}
