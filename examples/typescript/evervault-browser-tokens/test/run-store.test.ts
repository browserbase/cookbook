import assert from "node:assert/strict";
import test from "node:test";
import { RunStore } from "../src/run-store.js";
import { until } from "./fixtures.js";

test("checkpoints reject wrong and duplicate actions, and serialize comparisons", async () => {
  const store = new RunStore();
  const run = store.start(async (context) => {
    assert.equal(await context.waitForAdvance("enter_token", 1000), "advanced");
    assert.equal(await context.waitForAdvance("submit_token", 1000), "advanced");
    context.update({ cleanupStatus: "completed" });
  });
  assert.throws(() => store.start(async () => {}), /already active/);
  await until(() => store.get(run.runId)?.awaitingAction === "enter_token");
  assert.throws(() => store.advance(run.runId, "submit_token"));
  store.advance(run.runId, "enter_token");
  assert.throws(() => store.advance(run.runId, "enter_token"));
  await until(() => store.get(run.runId)?.awaitingAction === "submit_token");
  store.advance(run.runId, "submit_token");
  await store.settled(run.runId);
  assert.equal(store.get(run.runId)?.status, "succeeded");
});
test("Stop resolves a checkpoint, invokes cleanup, and clears display tokens and Live Views", async () => {
  const store = new RunStore();
  let closed = false;
  const run = store.start(async (context) => {
    context.setStopHook(async () => {
      closed = true;
    });
    context.update({
      displayCardTokens: { number: "synthetic-number", cvc: "synthetic-cvc" },
      proxiedLiveViewUrl: "https://fixture.browserbase.com",
      ...{ privateValue: "excluded" },
    });
    assert.equal(await context.waitForAdvance("enter_token", 1000), "stopped");
    context.update({ cleanupStatus: "completed" });
  });
  await until(() => Boolean(store.get(run.runId)?.awaitingAction));
  assert.ok(!JSON.stringify(store.get(run.runId)).includes("excluded"));
  await store.stop(run.runId);
  await store.settled(run.runId);
  assert.equal(closed, true);
  assert.equal(store.get(run.runId)?.status, "stopped");
  assert.equal(store.get(run.runId)?.displayCardTokens, undefined);
  assert.equal(store.get(run.runId)?.proxiedLiveViewUrl, undefined);
});
test("timeout does not advance a checkpoint", async () => {
  const store = new RunStore();
  const run = store.start(async (context) => {
    assert.equal(await context.waitForAdvance("submit_token", 5), "timed_out");
    context.update({ status: "stopped", cleanupStatus: "completed" });
  });
  await store.settled(run.runId);
  assert.equal(store.get(run.runId)?.status, "stopped");
});
test("a cleanup failure remains failed after Stop; private SDK errors are not exposed", async () => {
  const store = new RunStore();
  const run = store.start(async (context) => {
    await context.waitForAdvance("enter_token", 1000);
    context.update({ cleanupStatus: "failed" });
    throw new Error("private-sdk-response");
  });
  await until(() => Boolean(store.get(run.runId)?.awaitingAction));
  await store.stop(run.runId);
  await store.settled(run.runId);
  assert.equal(store.get(run.runId)?.status, "failed");
  assert.ok(!JSON.stringify(store.get(run.runId)).includes("private-sdk-response"));
});
