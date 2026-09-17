import assert from "node:assert/strict";
import test from "node:test";
import { run } from "../scripts/research-hacker-news.mjs";

test("the reusable script unwraps each Stagehand response envelope once", async () => {
  const calls = [];
  const newest = { description: "Newest", selector: "xpath=/html/body/a[1]" };
  const result = await run({
    page: {
      goto: async (url) => calls.push(["goto", url]),
    },
    stagehand: {
      observe: async () => ({
        data: [newest],
        metadata: { cache: { status: "hit" } },
      }),
      act: async (action) => calls.push(["act", action]),
      extract: async (_instruction, schema) => {
        const data = schema.parse({
          stories: [
            { rank: 1, title: "Synthetic story one" },
            { rank: 2, title: "Synthetic story two" },
          ],
        });
        return { data, metadata: { cache: { status: "miss" } } };
      },
    },
  });

  assert.deepEqual(calls, [
    ["goto", "https://news.ycombinator.com/"],
    ["act", newest],
  ]);
  assert.deepEqual(result, {
    stories: [
      { rank: 1, title: "Synthetic story one" },
      { rank: 2, title: "Synthetic story two" },
    ],
    cacheStatus: "miss",
  });
});

test("the reusable script fails clearly when observe returns no action", async () => {
  await assert.rejects(
    run({
      page: { goto: async () => {} },
      stagehand: {
        observe: async () => ({ data: [], metadata: {} }),
        act: async () => assert.fail("act must not run"),
        extract: async () => assert.fail("extract must not run"),
      },
    }),
    /did not find the newest stories link/,
  );
});
