import assert from "node:assert/strict";
import test from "node:test";
import { createExtractAllNotesTool, REPLAY_NOTES } from "./tool.js";
import { spawnDetached } from "../../../src/open-url.js";

test("notes replay follows pagination and finds a metadata-first notes array", async () => {
  const requests: number[] = [];
  const oldWindow = globalThis.window;
  const oldFetch = globalThis.fetch;
  Object.assign(globalThis, {
    window: {
      __nReq: { url: "https://synthetic.invalid/notes", method: "POST", headers: {}, body: "{}" },
      __customers: [{ id: "customer-1" }],
    },
    fetch: async (_url: string, init: RequestInit) => {
      const page = JSON.parse(String(init.body)).page;
      requests.push(page);
      const notes = page === 1
        ? Array.from({ length: 200 }, (_, id) => ({ id }))
        : [{ id: 200 }];
      return new Response(JSON.stringify({ metadata: { source: "synthetic" }, notes, total: 201, hasMore: page === 1 }));
    },
  });
  try {
    const result = await (0, eval)(REPLAY_NOTES);
    assert.deepEqual(requests, [1, 2]);
    assert.equal(result.done, true);
    assert.equal(result.notes, 201);
  } finally {
    Object.assign(globalThis, { window: oldWindow, fetch: oldFetch });
  }
});

test("tool reports partial when customer enumeration never finishes", async () => {
  let customerPasses = 0;
  const page = {
    evaluate: async (expr: string) => {
      if (expr.includes("reconstructed:false")) return { reconstructed: false };
      if (expr.includes("cReq: !!window.__cReq")) return { cReq: true, nReq: true };
      if (expr.includes("window.__cust_byId")) {
        customerPasses++;
        return { done: false, customers: 1, total: 2 };
      }
      if (expr.includes("const getNotes")) return { done: true, answered: 1, total: 1, notes: 0, newlyAnswered: 1 };
      if (expr.includes("platform-b_customer_notes.json")) return { rows: 0, phoneFilled: 0, sample: [] };
      throw new Error("unexpected expression");
    },
  };
  const stagehand = { browser: { context: { activePage: async () => page } } };
  const extractionTool = createExtractAllNotesTool(stagehand as never) as unknown as {
    execute: (input: unknown, options: unknown) => Promise<Record<string, unknown>>;
  };
  const result = await extractionTool.execute({}, {});
  assert.equal(customerPasses, 60);
  assert.equal(result.complete, false);
  assert.equal(result.customerEnumerationComplete, false);
  assert.equal(result.reportedCustomerTotal, 2);
});

test("missing best-effort opener is handled asynchronously", async () => {
  spawnDetached("definitely-not-a-real-browser-opener", ["https://synthetic.invalid"]);
  await new Promise((resolve) => setTimeout(resolve, 50));
});
