import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TOOL_DEFINITIONS, createDemoTools, validateToolCall } from "../src/tools.mjs";

test("the agent tool surface stays small", () => {
  assert.deepEqual(
    TOOL_DEFINITIONS.map((tool) => tool.name),
    ["run", "snapshot", "screenshot"],
  );
});

test("run needs code", () => {
  assert.throws(
    () => validateToolCall({ name: "run", input: {} }),
    /exactly one/,
  );
});

test("run rejects code and actions together", () => {
  assert.throws(
    () =>
      validateToolCall({
        name: "run",
        input: { code: "return 1", actions: [{ op: "click", id: "1-1" }] },
      }),
    /exactly one/,
  );
});

test("valid calls pass", () => {
  const call = { name: "snapshot", input: {} };
  assert.equal(validateToolCall(call), call);
});

test("run rejects unsupported and incomplete snapshot actions", () => {
  assert.throws(() => validateToolCall({ name: "run", input: { actions: [{ op: "dance", id: "1" }] } }), /Unsupported/);
  assert.throws(() => validateToolCall({ name: "run", input: { actions: [{ op: "fill", id: "1" }] } }), /string value/);
});

function syntheticSession(tree = "button Save") {
  let currentTree = tree;
  const calls = [];
  return {
    calls,
    setTree(value) { currentTree = value; },
    page: {
      url: async () => "https://example.test/same-url",
      snapshot: async () => ({ formattedTree: currentTree, xpathMap: { save: "/button[1]" } }),
      screenshot: async () => Buffer.from(currentTree),
    },
    stagehand: { experimentalBatch: async (_callback, input) => { calls.push(input); return { completed: input.actions.length }; } },
  };
}

test("snapshot actions reject same-URL replacement state and expire after use", async () => {
  const session = syntheticSession();
  const tools = createDemoTools(session);
  await tools.call({ name: "snapshot", input: {} });
  session.setTree("button Delete");
  await assert.rejects(tools.call({ name: "run", input: { actions: [{ op: "click", id: "save" }] } }), /page changed/);
  assert.equal(session.calls.length, 0);
  session.setTree("button Save");
  await tools.call({ name: "snapshot", input: {} });
  await tools.call({ name: "run", input: { actions: [{ op: "click", id: "save" }] } });
  await assert.rejects(tools.call({ name: "run", input: { actions: [{ op: "click", id: "save" }] } }), /Call snapshot/);
});

test("separate adapters preserve distinct screenshot evidence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "stagehand-artifacts-"));
  try {
    const first = createDemoTools(syntheticSession("first"), { artifactDirectory: directory });
    const second = createDemoTools(syntheticSession("second"), { artifactDirectory: directory });
    const a = await first.call({ name: "screenshot", input: {} });
    const b = await second.call({ name: "screenshot", input: {} });
    assert.notEqual(a.path, b.path);
    assert.equal(await readFile(a.path, "utf8"), "first");
    assert.equal(await readFile(b.path, "utf8"), "second");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
