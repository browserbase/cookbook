import test from "node:test";
import assert from "node:assert/strict";
import { contentIsSufficient, main, waitForRenderedContent } from "../05-browser-when-needed.js";

test("sufficient Fetch content avoids browser allocation", async () => {
  let allocations = 0;
  class BrowserbaseClient { constructor() { allocations++; } }
  const result = await main({
    request: async () => ({ json: async () => ({ content: "x".repeat(1700) }) }),
    BrowserbaseClient,
  });
  assert.deepEqual(result, { tier: "fetch", characters: 1700 });
  assert.equal(allocations, 0);
});

test("blocked browser content fails instead of reporting readiness", async () => {
  const page = {
    title: async () => "Just a moment…",
    evaluate: async () => 20,
    waitForTimeout: async () => {},
  };
  await assert.rejects(waitForRenderedContent(page, { attempts: 2, delayMs: 0 }), /did not become ready/);
});

test("readiness requires both a non-challenge title and enough content", () => {
  assert.equal(contentIsSufficient({ title: "Procurement", characters: 500 }), true);
  assert.equal(contentIsSufficient({ title: "Just a moment", characters: 1000 }), false);
  assert.equal(contentIsSufficient({ title: "Procurement", characters: 499 }), false);
});
