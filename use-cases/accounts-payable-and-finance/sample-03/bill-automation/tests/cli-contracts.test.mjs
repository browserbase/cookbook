import assert from "node:assert/strict";
import test from "node:test";
import {
  commandFailure,
  releaseSavedSession,
  requireSuccessfulAction,
} from "../scripts/cli-contracts.mjs";

test("invalid commands produce failure JSON and a nonzero exit code", () => {
  const failure = commandFailure(new Error("Unknown command: explode"));
  assert.equal(failure.exitCode, 1);
  assert.equal(failure.clearSession, false);
  assert.deepEqual(JSON.parse(failure.output), {
    success: false,
    error: "Unknown command: explode",
  });
});

test("an unsuccessful Stagehand action remains a command failure", () => {
  assert.throws(
    () =>
      requireSuccessfulAction(
        { data: { success: false, message: "target missing" } },
        "/tmp/evidence.png",
      ),
    /Action was unsuccessful: target missing.*evidence\.png/,
  );
  assert.doesNotThrow(() =>
    requireSuccessfulAction({ data: { success: true } }, "/tmp/evidence.png"),
  );
});

test("close releases expired saved IDs and clears state only after confirmation", async () => {
  const calls = [];
  let cleared = false;
  const result = await releaseSavedSession({
    loadSavedSession: () => ({ sessionId: "expired-local-metadata-is-still-addressable" }),
    requestRelease: async (sessionId) => calls.push(sessionId),
    clearSavedSession: () => {
      cleared = true;
    },
  });
  assert.deepEqual(calls, ["expired-local-metadata-is-still-addressable"]);
  assert.equal(cleared, true);
  assert.deepEqual(result, {
    success: true,
    message: "Session release requested",
  });
});

test("a failed release preserves the saved ID and exposes the error", async () => {
  let cleared = false;
  await assert.rejects(
    releaseSavedSession({
      loadSavedSession: () => ({ sessionId: "retryable-session" }),
      requestRelease: async () => {
        throw new Error("release not confirmed");
      },
      clearSavedSession: () => {
        cleared = true;
      },
    }),
    /release not confirmed/,
  );
  assert.equal(cleared, false);
});
