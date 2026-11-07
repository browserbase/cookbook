import { describe, expect, it } from "vitest";

import { BrowsieBrowserSession } from "../server/browser-session.js";
import type { ConversationState } from "../server/types.js";

const live = process.env.BROWSIE_LIVE_LOCAL_RUN === "1";

describe("opt-in local Stagehand run contract", () => {
  it.runIf(live)(
    "executes code and snapshot actions in one persistent browser",
    async () => {
      const state: ConversationState = {
        id: "local-run-contract",
        traces: [],
        browser: { provider: "not-started", status: "idle" },
      };
      const session = new BrowsieBrowserSession(state);
      try {
        const fixture = `data:text/html,${encodeURIComponent(`
          <title>Run contract fixture</title>
          <button id="increment" onclick="this.textContent = 'Count 1'">Count 0</button>
        `)}`;
        const opened = await session.run({
          code: `
            await page.goto(${JSON.stringify(fixture)});
            return { title: await page.title(), url: page.url() };
          `,
        });
        expect(opened).toMatchObject({
          mode: "code",
          value: { title: "Run contract fixture" },
        });

        const snapshot = await session.snapshot();
        const buttonId = snapshot.tree.match(/\[(\d+-\d+)\][^\n]*Count 0/u)?.[1];
        expect(buttonId).toBeDefined();
        const clicked = await session.run({
          actions: [{ op: "click", id: buttonId! }],
        });
        expect(clicked).toMatchObject({ mode: "actions", completed: 1 });

        const observed = await session.run({
          code: 'return await page.locator("#increment").textContent();',
        });
        expect(observed).toMatchObject({ mode: "code", value: "Count 1" });
      } finally {
        await session.close();
      }
    },
    60_000,
  );
});
