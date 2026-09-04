import assert from "node:assert/strict";
import test from "node:test";
import { MockLanguageModelV4 } from "ai/test";
import type { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import { runBrowserTask } from "./browser-task.js";
import { createRequestLifecycle } from "./src/app/api/browse/route-lifecycle.js";
import { getToolDisplay } from "./src/app/api/browse/route.js";

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

test("step limit never reports a completed task", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: "text", text: "I still need to inspect the page." }],
      finishReason: { unified: "stop", raw: "stop" },
      usage,
      warnings: [],
    },
  });
  const result = await runBrowserTask(
    {} as Stagehand,
    { instruction: "Read a listing", maxSteps: 1 },
    { model },
  );
  assert.equal(result.success, false);
  assert.equal(result.completed, false);
  assert.equal(result.output, undefined);
});

test("successful finish extracts the requested schema from the same session", async () => {
  const schema = z.object({ title: z.string() });
  let extractions = 0;
  const stagehand = {
    extract: async (instruction: string, output: unknown) => {
      assert.equal(instruction, "Read a listing");
      assert.equal(output, schema);
      extractions++;
      return { data: { title: "Synthetic listing" } };
    },
  } as unknown as Stagehand;
  const model = new MockLanguageModelV4({
    doGenerate: {
      content: [
        {
          type: "tool-call",
          toolCallId: "finish-1",
          toolName: "finish",
          input: JSON.stringify({ success: true, message: "Listing visible." }),
        },
      ],
      finishReason: { unified: "tool-calls", raw: "tool_calls" },
      usage,
      warnings: [],
    },
  });
  const result = await runBrowserTask(
    stagehand,
    { instruction: "Read a listing", output: schema },
    { model },
  );
  assert.equal(result.success, true);
  assert.equal(extractions, 1);
  assert.deepEqual(result.output, { title: "Synthetic listing" });
});

test("current tool inputs retain concrete action-log details", () => {
  assert.equal(getToolDisplay("navigate", { url: "https://www.zillow.com/homes" })?.message, "Navigating to www.zillow.com");
  assert.equal(getToolDisplay("act", { instruction: "Set the maximum price" })?.message, "Set the maximum price");
  assert.equal(getToolDisplay("extract", { instruction: "Read visible listings" })?.message, "Extracting: Read visible listings");
  assert.equal(getToolDisplay("finish", { success: true, message: "Filters verified" })?.message, "Filters verified");
});

test("request cancellation aborts work and independently closes owned resources", async () => {
  const request = new AbortController();
  let stagehandCloses = 0;
  let browserCloses = 0;
  const lifecycle = createRequestLifecycle(request.signal);
  await lifecycle.own({
    close: async () => { stagehandCloses++; },
    browser: { close: async () => { browserCloses++; } },
  } as unknown as Stagehand);
  request.abort();
  await lifecycle.cleanup();
  assert.equal(lifecycle.signal.aborted, true);
  assert.equal(stagehandCloses, 1);
  assert.equal(browserCloses, 1);
  await lifecycle.cleanup();
  assert.equal(stagehandCloses, 1);
});

test("a session created after an early disconnect is closed immediately", async () => {
  const request = new AbortController();
  const lifecycle = createRequestLifecycle(request.signal);
  request.abort();
  let closes = 0;
  await lifecycle.own({
    close: async () => { closes++; },
    browser: { close: async () => { closes++; } },
  } as unknown as Stagehand);
  assert.equal(closes, 2);
});
