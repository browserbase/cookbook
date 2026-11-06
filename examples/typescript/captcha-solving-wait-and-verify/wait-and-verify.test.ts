import assert from "node:assert/strict";
import { test } from "node:test";
import { CaptchaMonitor, waitAndVerify } from "./wait-and-verify.js";

const signal = (m: CaptchaMonitor, event: string) => m.receive(`browserbase-solving-${event}`);
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function fixture() {
  const monitor = new CaptchaMonitor();
  let navigations = 0;
  return {
    monitor,
    timeoutMs: 100,
    pollMs: 2,
    readinessGraceMs: 5,
    navigate: async () => {
      navigations++;
    },
    isReady: async () => false,
    count: () => navigations,
  };
}

test("a page without a challenge does not require solver events", async () => {
  const f = fixture();
  const result = await waitAndVerify({ ...f, isReady: async () => true });
  assert.equal(result.status, "ready");
  assert.equal(f.count(), 1);
});
test("finished with missing content navigates once, then verifies", async () => {
  const f = fixture();
  const navigate = async () => {
    await f.navigate();
    signal(f.monitor, "finished");
  };
  const result = await waitAndVerify({ ...f, navigate, isReady: async () => f.count() === 2 });
  assert.deepEqual(result, { status: "ready", renavigated: true });
  assert.equal(f.count(), 2);
});
test("finished is not success and repeated finishes cannot cause a navigation loop", async () => {
  const f = fixture();
  const result = await waitAndVerify({
    ...f,
    navigate: async () => {
      await f.navigate();
      signal(f.monitor, "finished");
    },
  });
  assert.deepEqual(result, { status: "blocked", renavigated: true });
  assert.equal(f.count(), 2);
});
test("no page checks or recovery navigation during an active solve", async () => {
  const f = fixture();
  let checks = 0;
  const result = await waitAndVerify({
    ...f,
    navigate: async () => {
      await f.navigate();
      signal(f.monitor, "started");
    },
    isReady: async () => {
      checks++;
      return true;
    },
  });
  assert.equal(result.status, "solving-timeout");
  assert.equal(checks, 0);
  assert.equal(f.count(), 1);
});
test("errored waits for a fresh challenge within the same deadline", async () => {
  const f = fixture();
  let ready = false;
  const retry = (async () => {
    await delay(10);
    signal(f.monitor, "started");
    await delay(10);
    ready = true;
    signal(f.monitor, "finished");
  })();
  const result = await waitAndVerify({
    ...f,
    navigate: async () => signal(f.monitor, "errored"),
    isReady: async () => ready,
  });
  await retry;
  assert.equal(result.status, "ready");
  assert.equal(result.renavigated, false);
});
test("an error without retry reaches failure without re-navigation", async () => {
  const f = fixture();
  const result = await waitAndVerify({
    ...f,
    navigate: async () => {
      await f.navigate();
      signal(f.monitor, "errored");
    },
  });
  assert.equal(result.status, "blocked");
  assert.equal(f.count(), 1);
});
test("a challenge arriving during readiness cannot return stale success", async () => {
  const f = fixture();
  const result = await waitAndVerify({
    ...f,
    isReady: async () => {
      signal(f.monitor, "started");
      return true;
    },
  });
  assert.equal(result.status, "solving-timeout");
});
test("deadline bounds a stalled navigation and readiness check", async () => {
  for (const operation of ["navigate", "isReady"] as const) {
    const f = fixture();
    const result = await waitAndVerify({ ...f, [operation]: () => new Promise<never>(() => {}) });
    assert.equal(result.status, "blocked");
  }
});
test("ready after finished needs no revisit; unrelated console output is ignored", async () => {
  const f = fixture();
  f.monitor.receive("unrelated browserbase-solving-started text");
  assert.equal(f.monitor.revision, 0);
  const result = await waitAndVerify({
    ...f,
    navigate: async () => signal(f.monitor, "finished"),
    isReady: async () => true,
  });
  assert.deepEqual(result, { status: "ready", renavigated: false });
});
test("ordinary browser failures propagate instead of masquerading as CAPTCHA failure", async () => {
  await assert.rejects(
    waitAndVerify({
      ...fixture(),
      isReady: async () => {
        throw new Error("closed");
      },
    }),
    /closed/,
  );
});
