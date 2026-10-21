import assert from "node:assert/strict";
import test from "node:test";
import { executeCardRun, waitForCardOutcome, type CardRuntime } from "../src/card-run.js";
import { parseCardBrowserTokens } from "../src/evervault.js";
import { RunStore } from "../src/run-store.js";
import { config, encryptedCard, rawTokens, until } from "./fixtures.js";

function harness(
  options: { failLaunch?: number; failAttach?: number; failCleanup?: boolean } = {},
) {
  const launches: Array<Parameters<CardRuntime["launch"]>[0]> = [];
  const released: string[] = [];
  const browserClosed: number[] = [];
  const stagehandClosed: number[] = [];
  const submissions: number[] = [];
  const fills: string[] = [];
  let attachIndex = 0;
  const tokens = parseCardBrowserTokens(rawTokens(), new Date(Date.now() + 300_000).toISOString());
  const runtime: CardRuntime = {
    tokens: async () => tokens,
    launch: (async (launchOptions: Parameters<CardRuntime["launch"]>[0]) => {
      const index = launches.length;
      launches.push(launchOptions);
      if (index === options.failLaunch) throw new Error("fixture-launch-private-detail");
      const page = {
        goto: async () => {},
        waitForSelector: async () => true,
        url: async () => `https://${config.cardTargetHost}/mock-merchant/checkout`,
        locator: () => ({
          fill: async (value: string) => {
            fills.push(value);
          },
        }),
        evaluate: async (_fn: unknown, args?: { expectedNumber: string; expectedCvc: string }) => {
          if (args) {
            assert.equal(args.expectedNumber, tokens.numberToken);
            assert.equal(args.expectedCvc, tokens.cvcToken);
            submissions.push(index);
            return true;
          }
          return {
            url: `https://${config.cardTargetHost}/mock-merchant/authorize`,
            outcome: index === 0 ? "approved" : "declined",
          };
        },
      };
      return {
        sessionId: `fixture-session-${index}`,
        closed: false,
        context: { activePage: async () => page },
        close: async () => {
          browserClosed.push(index);
        },
      };
    }) as unknown as CardRuntime["launch"],
    attach: (async () => {
      const index = attachIndex++;
      if (index === options.failAttach) throw new Error("fixture-attach-private-detail");
      return {
        close: async () => {
          stagehandClosed.push(index);
        },
      };
    }) as unknown as CardRuntime["attach"],
    debug: async () => ({ debuggerFullscreenUrl: "https://fixture.browserbase.com/fixture-view" }),
    release: async (id) => {
      released.push(id);
      if (options.failCleanup) throw new Error("fixture-cleanup-private-detail");
    },
    retrieve: async () => ({ status: "COMPLETED" }),
  };
  const store = new RunStore();
  const card = encryptedCard();
  const start = () =>
    store.start((context) =>
      executeCardRun(config, card, context, {
        runtime,
        holdMs: 0,
        gateMs: 1000,
        completionPollMs: 100,
      }),
    );
  return {
    runtime,
    tokens,
    store,
    start,
    card,
    launches,
    released,
    browserClosed,
    stagehandClosed,
    submissions,
    fills,
  };
}

test("matched sessions differ only in proxy/CA and metadata; only tokens are filled; both outcomes and cleanup are verified", async () => {
  const h = harness();
  const run = h.start();
  await until(() => h.store.get(run.runId)?.awaitingAction === "enter_token");
  const [proxied, direct] = h.launches;
  assert.deepEqual(proxied?.browserSettings, direct?.browserSettings);
  assert.deepEqual(proxied?.browserSettings?.allowedDomains, [config.cardTargetHost]);
  assert.equal(proxied?.browserSettings?.recordSession, false);
  assert.equal(proxied?.browserSettings?.logSession, false);
  assert.equal(proxied?.keepAlive, false);
  assert.ok(proxied?.proxies);
  assert.equal(direct?.proxies, undefined);
  assert.deepEqual(proxied?.proxySettings, { caCertificates: [config.caCertificateId] });
  assert.equal(h.card.number, "");
  assert.equal(h.card.cvc, "");
  h.store.advance(run.runId, "enter_token");
  await until(() => h.store.get(run.runId)?.awaitingAction === "submit_token");
  assert.equal(h.fills.filter((value) => value === h.tokens.numberToken).length, 2);
  h.store.advance(run.runId, "submit_token");
  await h.store.settled(run.runId);
  const result = h.store.get(run.runId)!;
  assert.equal(result.status, "succeeded");
  assert.equal(result.proxiedOutcome, "approved");
  assert.equal(result.controlOutcome, "rejected_as_expected");
  assert.equal(result.cleanupStatus, "completed");
  assert.equal(h.submissions.length, 2);
  assert.equal(new Set(h.released).size, 2);
  assert.equal(h.stagehandClosed.length, 2);
  assert.equal(h.browserClosed.length, 2);
  assert.equal(result.displayCardTokens, undefined);
  assert.equal(result.proxiedLiveViewUrl, undefined);
  assert.ok(!JSON.stringify(result).includes("fixture-proxy-value"));
  assert.ok(!JSON.stringify(result).includes("fixture-session"));
});

for (const failure of [{ failLaunch: 1 }, { failAttach: 1 }]) {
  test(`cleans every acquired resource after ${"failLaunch" in failure ? "partial launch" : "partial attachment"}`, async () => {
    const h = harness(failure);
    const run = h.start();
    await h.store.settled(run.runId);
    assert.equal(h.store.get(run.runId)?.status, "failed");
    assert.equal(h.store.get(run.runId)?.cleanupStatus, "completed");
    assert.equal(new Set(h.released).size, "failLaunch" in failure ? 1 : 2);
    assert.equal(h.submissions.length, 0);
    assert.equal(h.card.number, "");
    assert.ok(!JSON.stringify(h.store.get(run.runId)).includes("private-detail"));
  });
}

test("Stop at the submit checkpoint never submits", async () => {
  const h = harness();
  const run = h.start();
  await until(() => h.store.get(run.runId)?.awaitingAction === "enter_token");
  h.store.advance(run.runId, "enter_token");
  await until(() => h.store.get(run.runId)?.awaitingAction === "submit_token");
  await h.store.stop(run.runId);
  await h.store.settled(run.runId);
  assert.equal(h.submissions.length, 0);
  assert.equal(h.store.get(run.runId)?.status, "stopped");
  assert.equal(h.store.get(run.runId)?.cleanupStatus, "completed");
});

test("expiry is rechecked immediately before submission", async () => {
  const h = harness();
  const run = h.start();
  await until(() => h.store.get(run.runId)?.awaitingAction === "enter_token");
  h.store.advance(run.runId, "enter_token");
  await until(() => h.store.get(run.runId)?.awaitingAction === "submit_token");
  h.tokens.expiresAt = new Date(0).toISOString();
  h.store.advance(run.runId, "submit_token");
  await h.store.settled(run.runId);
  assert.equal(h.submissions.length, 0);
  assert.equal(h.store.get(run.runId)?.error?.code, "BROWSER_TOKEN_EXPIRED");
  assert.equal(h.store.get(run.runId)?.cleanupStatus, "completed");
});

test("checkpoint timeout releases both sessions without entering or submitting tokens", async () => {
  const h = harness();
  const run = h.store.start((context) =>
    executeCardRun(config, encryptedCard(), context, {
      runtime: h.runtime,
      gateMs: 5,
      completionPollMs: 100,
    }),
  );
  await h.store.settled(run.runId);
  assert.equal(h.fills.length, 0);
  assert.equal(h.submissions.length, 0);
  assert.equal(h.store.get(run.runId)?.status, "stopped");
  assert.equal(new Set(h.released).size, 2);
});

for (const phase of ["launch", "attach"] as const) {
  test(`Stop during ${phase} releases resources that arrive after cancellation`, async () => {
    const h = harness();
    let unblock!: () => void;
    const blocked = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    let entered = false;
    if (phase === "launch") {
      const original = h.runtime.launch;
      h.runtime.launch = async (options) => {
        entered = true;
        await blocked;
        return original(options);
      };
    } else {
      const original = h.runtime.attach;
      h.runtime.attach = async (options) => {
        entered = true;
        await blocked;
        return original(options);
      };
    }
    const run = h.start();
    await until(() => entered);
    await h.store.stop(run.runId);
    unblock();
    await h.store.settled(run.runId);
    assert.equal(h.submissions.length, 0);
    assert.equal(new Set(h.released).size, 2);
    assert.equal(h.browserClosed.length, 2);
    if (phase === "attach") assert.equal(h.stagehandClosed.length, 2);
    assert.equal(h.store.get(run.runId)?.status, "stopped");
  });
}

test("cleanup failure remains visible after Stop and never exposes raw provider details", async () => {
  const h = harness({ failCleanup: true });
  const run = h.start();
  await until(() => Boolean(h.store.get(run.runId)?.awaitingAction));
  await h.store.stop(run.runId);
  await h.store.settled(run.runId);
  assert.equal(h.store.get(run.runId)?.cleanupStatus, "failed");
  assert.equal(h.store.get(run.runId)?.status, "failed");
  assert.ok(!JSON.stringify(h.store.get(run.runId)).includes("private-detail"));
});

test("outcome checks reject a different host, path, scheme, or ambiguous result", async () => {
  for (const url of [
    "https://other.example.com/mock-merchant/authorize",
    "https://cards.example.com/wrong",
    "http://cards.example.com/mock-merchant/authorize",
  ]) {
    await assert.rejects(() =>
      waitForCardOutcome(
        { evaluate: async () => ({ url, outcome: "approved" }) } as never,
        config.cardTargetHost,
        "approved",
        1,
      ),
    );
  }
  await assert.rejects(() =>
    waitForCardOutcome(
      {
        evaluate: async () => ({
          url: "https://cards.example.com/mock-merchant/authorize",
          outcome: "unknown",
        }),
      } as never,
      config.cardTargetHost,
      "approved",
      1,
    ),
  );
});
