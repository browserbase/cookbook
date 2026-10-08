import { describe, expect, it } from "vitest";

import { BrowsieBrowserSession } from "../server/browser-session.js";
import type { ConversationState } from "../server/types.js";

const live = process.env.BROWSIE_LIVE_CAPTCHA === "1" && Boolean(process.env.BROWSERBASE_API_KEY);
describe("opt-in hosted CAPTCHA marker fixture", () => {
  it.runIf(live)(
    "subscribes before navigation, gates, re-observes, and cleans up",
    async () => {
      const state: ConversationState = {
        id: "captcha-live-fixture",
        traces: [],
        browser: { provider: "not-started", status: "idle" },
      };
      const session = new BrowsieBrowserSession(state);
      try {
        const fixture =
          "data:text/html," +
          encodeURIComponent(
            "<title>captcha fixture</title><h1>After solve</h1><script>console.log('browserbase-solving-started');setTimeout(()=>console.log('browserbase-solving-finished'),50)</script>",
          );
        const result = await session.run([
          { action: "goto", url: fixture },
          { action: "wait", milliseconds: 150 },
        ]);
        expect(result.completed).toBe(2);
        expect(state.traces.map((event) => event.name)).toEqual(
          expect.arrayContaining(["captcha.started", "captcha.finished", "captcha.observed"]),
        );
        const transitions = session.drainCaptchaTransitions();
        expect(transitions.map((event) => event.type)).toEqual(["started", "finished"]);
        expect(JSON.stringify({ transitions, traces: state.traces })).not.toMatch(
          /devtools|debuggerFullscreenUrl|wss=/i,
        );
      } finally {
        await session.close();
        expect(
          (session as unknown as { captchaSubscriptions: Map<string, unknown> })
            .captchaSubscriptions.size,
        ).toBe(0);
      }
    },
    60_000,
  );
});
