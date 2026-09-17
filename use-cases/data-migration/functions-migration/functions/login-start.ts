import { defineFn } from "@browserbasehq/sdk-functions";
import Browserbase from "@browserbasehq/sdk";
import { chromium } from "playwright-core";
import { z } from "zod";
import { BROWSERBASE_API_KEY } from "../shared/config";

/**
 * platform-a-login-start — begin an interactive login. Creates a fresh context + a keepAlive session bound to
 * it with persist:true (so the human's login is written back), pre-navigates to Platform A's login page, and
 * returns the Live View URL the customer opens to sign in. A single function invocation can't block for a
 * human, so this returns immediately; call `platform-a-login-finish` with the returned sessionId once they're
 * signed in to flush the login into the context. The returned `contextId` is what every workflow function
 * takes as `params.contextId`.
 */
const params = z.object({
  startUrl: z
    .string()
    .optional()
    .describe("Login page to land on (default: Platform A login)."),
});

const LOGIN_TIMEOUT_S = 20 * 60; // generous: a remote customer needs time to find their password + clear MFA

defineFn(
  "platform-a-login-start",
  async (_context, raw) => {
    const p = raw as z.infer<typeof params>;
    const bb = new Browserbase({ apiKey: BROWSERBASE_API_KEY });
    const startUrl = p.startUrl || "https://platform-a.example.invalid/login";

    // projectId omitted — the API key scopes the project (keeps context + later sessions in the same one).
    const ctx = await (bb.contexts.create as any)({});
    const session = await (bb.sessions.create as any)({
      keepAlive: true,
      proxies: false,
      timeout: LOGIN_TIMEOUT_S,
      browserSettings: {
        context: { id: ctx.id, persist: true },
        viewport: { width: 1288, height: 711 },
      },
    });

    // Land the Live View on the login page (best-effort; if it fails the customer can navigate themselves).
    try {
      const browser = await chromium.connectOverCDP(session.connectUrl);
      const page =
        browser.contexts()[0]?.pages()[0] ??
        (await browser.contexts()[0]!.newPage());
      await page.goto(startUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await browser.close().catch(() => {});
    } catch {
      // non-fatal — keepAlive keeps the session up regardless
    }

    const dbg = await bb.sessions.debug(session.id);
    return {
      contextId: ctx.id,
      sessionId: session.id,
      liveViewUrl: dbg.debuggerFullscreenUrl,
      startUrl,
      next: "Open liveViewUrl, sign in, then invoke platform-a-login-finish with this sessionId.",
    };
  },
  { parametersSchema: params },
);
