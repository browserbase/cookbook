import assert from "node:assert/strict";
import test from "node:test";
import { CurrentRun } from "../src/run.js";
import { deferred, until } from "./fixtures.js";

test("one active comparison includes cleanup; only the latest result is retained", async () => {
  const runs = new CurrentRun(),
    blocked = deferred();
  const run = runs.start(async (context) => {
    await blocked.promise;
    context.update({ cleanupStatus: "completed" });
  });
  assert.throws(() => runs.start(async () => {}), /already active/);
  blocked.resolve();
  await runs.settled(run.runId);
  assert.equal(runs.get(run.runId)?.status, "succeeded");
  const next = runs.start(async (context) => {
    context.update({ cleanupStatus: "completed" });
  });
  assert.equal(runs.get(run.runId), undefined);
  await runs.settled(next.runId);
  assert.equal(runs.get(next.runId)?.status, "succeeded");
});
test("Cancel clears tokens after cleanup and excludes arbitrary private properties", async () => {
  const runs = new CurrentRun(),
    blocked = deferred();
  const run = runs.start(async (context) => {
    context.update({
      displayCardTokens: { number: "4000000000000002", cvc: "987" },
      ...{ privateValue: "excluded" },
    });
    await blocked.promise;
    context.update({ cleanupStatus: "completed" });
  });
  await until(() => Boolean(runs.get(run.runId)?.displayCardTokens));
  const copy = runs.get(run.runId)!;
  copy.displayCardTokens!.number = "changed";
  assert.equal(runs.get(run.runId)?.displayCardTokens?.number, "4000000000000002");
  assert.ok(!JSON.stringify(copy).includes("excluded"));
  assert.equal(runs.stop("missing"), undefined);
  runs.stop(run.runId);
  blocked.resolve();
  await runs.settled(run.runId);
  assert.equal(runs.get(run.runId)?.status, "stopped");
  assert.equal(runs.get(run.runId)?.displayCardTokens, undefined);
});
test("private failures are redacted and unconfirmed cleanup cannot report success", async () => {
  const runs = new CurrentRun();
  const run = runs.start(async () => {
    throw new Error("private-sdk-response");
  });
  await runs.settled(run.runId);
  assert.equal(runs.get(run.runId)?.status, "failed");
  assert.equal(runs.get(run.runId)?.cleanupStatus, "failed");
  assert.ok(!JSON.stringify(runs.get(run.runId)).includes("private-sdk-response"));
});
test("shutdown cancels and waits for cleanup", async () => {
  const runs = new CurrentRun();
  let entered = false;
  const run = runs.start(async (context) => {
    entered = true;
    await new Promise<void>((resolve) =>
      context.signal.addEventListener("abort", () => resolve(), { once: true }),
    );
    context.update({ cleanupStatus: "completed" });
  });
  await until(() => entered);
  await runs.shutdown();
  assert.equal(runs.get(run.runId)?.status, "stopped");
});
