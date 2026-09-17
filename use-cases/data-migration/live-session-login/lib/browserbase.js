import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import Browserbase from "@browserbasehq/sdk";
import { chromium } from "playwright-core";

// How long the one-time login session stays open. Generous so the customer has time
// to find their password and clear MFA in the embedded Live View.
const LOGIN_SESSION_TIMEOUT_S = 20 * 60;

/** Browserbase SDK client, authed from BROWSERBASE_API_KEY. */
export function makeBrowserbase() {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "BROWSERBASE_API_KEY is not set. Copy .env.example to .env and add your key.",
    );
  }
  return new Browserbase({ apiKey });
}

/** Create a fresh, empty context and return its id. This is what holds the saved login. */
export async function createContext(bb) {
  const ctx = await bb.contexts.create({});
  return ctx.id;
}

/**
 * Start a browser session bound to a context for the login flow.
 *
 * The two settings that matter:
 *   - context.persist = true  -> the login (cookies/session) is written back into the context on end.
 *   - keepAlive = true        -> the session stays open while the customer logs in via the Live View.
 *
 * Returns { sessionId, connectUrl }.
 */
export async function createLoginSession(bb, contextId) {
  const session = await bb.sessions.create({
    keepAlive: true,
    proxies: false,
    api_timeout: LOGIN_SESSION_TIMEOUT_S,
    browserSettings: {
      context: { id: contextId, persist: true },
      viewport: { width: 1288, height: 711 },
    },
  });
  return { sessionId: session.id, connectUrl: session.connectUrl };
}

/**
 * Open the login page in the session so the Live View lands on it instead of a blank tab.
 * We connect over CDP just long enough to navigate, then disconnect. keepAlive keeps the
 * session running. This step is optional — remove it if you'd rather the customer navigate
 * themselves inside the Live View.
 */
export async function preNavigate(connectUrl, url) {
  const browser = await chromium.connectOverCDP(connectUrl);
  try {
    const ctx = browser.contexts()[0];
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  } finally {
    // Disconnects our CDP client; the Browserbase session stays alive via keepAlive.
    await browser.close().catch(() => {});
  }
}

/**
 * Fetch the interactive Live View URL for a session. Call this after the session exists;
 * these URLs are session-scoped. This is what you put in the iframe `src`.
 */
export async function liveViewUrl(bb, sessionId) {
  const dbg = await bb.sessions.debug(sessionId);
  return dbg.debuggerFullscreenUrl;
}

/** Ask Browserbase to end the session. For a persist:true context, auth is flushed on end. */
export async function releaseSession(bb, sessionId) {
  await bb.sessions.update(sessionId, { status: "REQUEST_RELEASE" });
}

/**
 * Wait for successful session completion before handing back the context id.
 * Pending/running states keep polling; failed states and deadlines reject.
 */
export async function waitUntilReleased(
  bb,
  sessionId,
  { timeoutMs = 30_000, intervalMs = 1_500 } = {},
) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new TypeError("Polling durations must be positive finite numbers");
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const s = await bb.sessions.retrieve(sessionId);
    if (s.status === "COMPLETED") return;
    if (!["PENDING", "RUNNING"].includes(s.status)) {
      throw new Error(`Session did not complete successfully: ${s.status}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Timed out waiting for session completion; context was not saved. Retry finishing the session.");
}

/**
 * Upsert a single KEY=value line in a .env file, in place. Replaces the line if present,
 * otherwise appends, so re-running never stacks duplicates. Other lines stay untouched.
 *
 * This is just a convenient place to stash the context id for the demo. In your own app,
 * store it in your database keyed to the user instead.
 */
export async function upsertEnv(path, key, value) {
  if (typeof key !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    throw new TypeError("Invalid environment key");
  }
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new TypeError("Environment value must be a plain identifier");
  }
  let lines = [];
  if (existsSync(path)) {
    lines = (await readFile(path, "utf8")).split(/\r?\n/);
  }

  const re = new RegExp(`^\\s*${key}\\s*=`);
  let found = false;
  lines = lines.map((line) => {
    if (re.test(line)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
    lines.push(`${key}=${value}`);
  }

  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  await writeFile(path, lines.join("\n") + "\n", "utf8");
}
