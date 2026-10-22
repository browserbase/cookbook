import Browserbase from "@browserbasehq/sdk";
import { describe, expect, it } from "vitest";

import { BrowsieBrowserSession } from "../server/browser-session.js";
import type { ConversationState } from "../server/types.js";

const live = process.env.BROWSIE_LIVE_CONTEXT === "1" && Boolean(process.env.BROWSERBASE_API_KEY);

describe("opt-in live Context save", () => {
  it.runIf(live)(
    "captures state in an automatically attached draft Context",
    async () => {
      const apiKey = process.env.BROWSERBASE_API_KEY!;
      const sdk = new Browserbase({ apiKey });
      const marker = `browsie-${Date.now()}`;
      const remote = await sdk.contexts.create({
        name: `Browsie test ${Date.now()}`,
        ...(process.env.BROWSERBASE_PROJECT_ID
          ? { projectId: process.env.BROWSERBASE_PROJECT_ID }
          : {}),
      });
      const state = (id: string): ConversationState => ({
        id,
        traces: [],
        browser: { provider: "not-started", status: "idle" },
      });
      let writer: BrowsieBrowserSession | undefined;
      let reader: BrowsieBrowserSession | undefined;
      try {
        const writerState = state("context-capture-writer");
        writer = new BrowsieBrowserSession(writerState, {
          ensureContext: async () => ({ id: remote.id, status: "draft" }),
        });
        await writer.importCookies(
          [
            {
              name: "browsie_context_test",
              value: marker,
              url: "https://example.com/",
            },
          ],
          "https://example.com/",
        );
        expect(writerState.browser).toMatchObject({
          contextId: remote.id,
          contextStatus: "draft",
        });
        await writer.close();
        await new Promise((resolve) => setTimeout(resolve, 5_000));

        reader = new BrowsieBrowserSession(state("context-capture-reader"), {
          contextId: remote.id,
        });
        await reader.run({ code: 'await page.goto("https://example.com/");' });
        const restored = await reader.exportCookies();
        expect(restored.some((cookie) => cookie.value === marker)).toBe(true);
      } finally {
        await writer?.close();
        await reader?.close();
        await sdk.contexts.delete(remote.id).catch(() => undefined);
      }
    },
    120_000,
  );
});
