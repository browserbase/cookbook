import assert from "node:assert/strict";
import test from "node:test";
import { executeCardRun, waitForCardOutcome, type CardRuntime } from "../src/card-run.js";
import { parseCardBrowserTokens } from "../src/evervault.js";
import { CurrentRun } from "../src/run.js";
import { config, encryptedCard, rawTokens, until, deferred } from "./fixtures.js";

type Phase = "tokens" | "launch" | "attach" | "page" | "navigate" | "fill";
function harness(
  options: {
    pause?: Phase;
    expireAt?: Phase;
    failLaunch?: number;
    failAttach?: number;
    failCleanup?: boolean;
    failCompletion?: boolean;
    failNavigation?: boolean;
    recoverableNavigation?: boolean;
    invalidDom?: boolean;
  } = {},
) {
  const launches: Array<Parameters<CardRuntime["launch"]>[0]> = [];
  const released: string[] = [],
    fills: string[] = [];
  const browserClosed: number[] = [],
    stagehandClosed: number[] = [],
    submissions: number[] = [];
  const blocked = deferred();
  let entered = false,
    attachIndex = 0;
  const tokens = parseCardBrowserTokens(rawTokens(), new Date(Date.now() + 300_000).toISOString());
  const boundary = async (phase: Phase) => {
    if (options.pause === phase) {
      entered = true;
      await blocked.promise;
    }
    if (options.expireAt === phase) tokens.expiresAt = new Date(0).toISOString();
  };
  const runtime: CardRuntime = {
    tokens: async () => {
      await boundary("tokens");
      return tokens;
    },
    launch: (async (settings: Parameters<CardRuntime["launch"]>[0]) => {
      const index = launches.length;
      launches.push(settings);
      await boundary("launch");
      if (index === options.failLaunch) throw new Error("fixture-launch-private-detail");
      const page = {
        goto: async () => {
          await boundary("navigate");
          if (options.failNavigation) throw new Error("fixture-navigation-private-detail");
          if (options.recoverableNavigation) throw new Error("RPC response timed out: page.goto");
        },
        waitForSelector: async () => true,
        url: async () => `https://${config.cardTargetHost}/mock-merchant/checkout`,
        locator: () => ({
          fill: async (value: string) => {
            fills.push(value);
            await boundary("fill");
          },
        }),
        evaluate: async (_fn: unknown, args?: { expectedNumber: string; expectedCvc: string }) => {
          if (args) {
            assert.equal(args.expectedNumber, tokens.numberToken);
            assert.equal(args.expectedCvc, tokens.cvcToken);
            if (options.invalidDom) return false;
            submissions.push(index);
            return true;
          }
          return {
            url: `https://${config.cardTargetHost}/mock-merchant/authorize`,
            outcome: index === 0 ? "approved" : "declined",
          };
        },
      };
      const browser = {
        sessionId: `fixture-session-${index}` as string | undefined,
        closed: false,
        context: {
          activePage: async () => {
            await boundary("page");
            return page;
          },
        },
        close: async () => {
          browserClosed.push(index);
          browser.closed = true;
          browser.sessionId = undefined;
        },
      };
      return browser;
    }) as unknown as CardRuntime["launch"],
    attach: (async () => {
      const index = attachIndex++;
      await boundary("attach");
      if (index === options.failAttach) throw new Error("fixture-attach-private-detail");
      return {
        close: async () => {
          stagehandClosed.push(index);
        },
      };
    }) as unknown as CardRuntime["attach"],
    release: async (id) => {
      released.push(id);
      if (options.failCleanup) throw new Error("fixture-cleanup-private-detail");
    },
    retrieve: async () => ({ status: options.failCompletion ? "ERROR" : "COMPLETED" }),
  };
  const runs = new CurrentRun();
  const card = encryptedCard();
  const start = () =>
    runs.start((context) =>
      executeCardRun(config, card, context, { runtime, completionPollMs: 100 }),
    );
  return {
    runs,
    start,
    card,
    tokens,
    launches,
    released,
    fills,
    submissions,
    browserClosed,
    stagehandClosed,
    unblock: blocked.resolve,
    entered: () => entered,
  };
}

test("automatically compares matched sessions using only tokens and confirms cleanup", async () => {
  const h = harness({ pause: "navigate" });
  const run = h.start();
  await until(h.entered);
  const [proxied, direct] = h.launches;
  assert.deepEqual(proxied?.browserSettings, direct?.browserSettings);
  assert.deepEqual(proxied?.browserSettings?.allowedDomains, [config.cardTargetHost]);
  assert.equal(proxied?.browserSettings?.recordSession, false);
  assert.equal(proxied?.browserSettings?.logSession, false);
  assert.equal(proxied?.browserSettings?.ignoreCertificateErrors, false);
  assert.equal(proxied?.keepAlive, false);
  assert.ok(proxied?.proxies);
  assert.equal(direct?.proxies, undefined);
  assert.deepEqual(proxied?.proxySettings, { caCertificates: [config.caCertificateId] });
  assert.deepEqual(h.runs.get(run.runId)?.displayCardTokens, {
    number: h.tokens.numberToken,
    cvc: h.tokens.cvcToken,
  });
  assert.equal(h.card.number, "");
  assert.equal(h.card.cvc, "");
  h.unblock();
  await h.runs.settled(run.runId);
  assert.equal(h.fills.filter((value) => value === h.tokens.numberToken).length, 2);
  assert.equal(h.fills.filter((value) => value === h.tokens.cvcToken).length, 2);
  assert.equal(h.submissions.length, 2);
  assert.equal(h.runs.get(run.runId)?.status, "succeeded");
  assert.equal(h.runs.get(run.runId)?.proxiedOutcome, "approved");
  assert.equal(h.runs.get(run.runId)?.controlOutcome, "rejected_as_expected");
  assert.equal(h.runs.get(run.runId)?.cleanupStatus, "completed");
  assert.equal(h.runs.get(run.runId)?.displayCardTokens, undefined);
  assert.equal(new Set(h.released).size, 2);
  assert.equal(h.browserClosed.length, 2);
  assert.equal(h.stagehandClosed.length, 2);
  assert.ok(!JSON.stringify(h.runs.get(run.runId)).includes("fixture-session"));
  assert.ok(!JSON.stringify(h.runs.get(run.runId)).includes("fixture-proxy-value"));
});

for (const failure of [{ failLaunch: 1 }, { failAttach: 1 }, { failNavigation: true }]) {
  test(`partial failure releases every acquired session: ${JSON.stringify(failure)}`, async () => {
    const h = harness(failure);
    const run = h.start();
    await h.runs.settled(run.runId);
    assert.equal(h.runs.get(run.runId)?.status, "failed");
    assert.equal(h.runs.get(run.runId)?.cleanupStatus, "completed");
    assert.equal(new Set(h.released).size, "failLaunch" in failure ? 1 : 2);
    assert.equal(h.submissions.length, 0);
    assert.equal(h.card.number, "");
    assert.ok(!JSON.stringify(h.runs.get(run.runId)).includes("private-detail"));
  });
}
for (const phase of ["tokens", "launch", "attach", "page", "navigate", "fill"] as const) {
  test(`Cancel during ${phase} prevents submission and cleans late resources`, async () => {
    const h = harness({ pause: phase });
    const run = h.start();
    await until(h.entered);
    h.runs.stop(run.runId);
    assert.throws(() => h.start(), /already active/);
    h.unblock();
    await h.runs.settled(run.runId);
    assert.equal(h.submissions.length, 0);
    assert.equal(new Set(h.released).size, phase === "tokens" ? 0 : 2);
    assert.equal(h.runs.get(run.runId)?.status, "stopped");
    assert.equal(h.runs.get(run.runId)?.displayCardTokens, undefined);
  });
}
for (const phase of ["tokens", "navigate", "fill"] as const) {
  test(`expiry after ${phase} prevents any submission`, async () => {
    const h = harness({ expireAt: phase });
    const run = h.start();
    await h.runs.settled(run.runId);
    assert.equal(h.submissions.length, 0);
    assert.equal(h.runs.get(run.runId)?.error?.code, "BROWSER_TOKEN_EXPIRED");
    assert.equal(h.runs.get(run.runId)?.cleanupStatus, "completed");
  });
}
for (const failure of [{ failCleanup: true }, { failCompletion: true }]) {
  test(`cleanup failure stays visible after Cancel: ${JSON.stringify(failure)}`, async () => {
    const h = harness({ ...failure, pause: "navigate" });
    const run = h.start();
    await until(h.entered);
    h.runs.stop(run.runId);
    h.unblock();
    await h.runs.settled(run.runId);
    assert.equal(h.runs.get(run.runId)?.status, "failed");
    assert.equal(h.runs.get(run.runId)?.cleanupStatus, "failed");
    assert.ok(!JSON.stringify(h.runs.get(run.runId)).includes("private-detail"));
  });
}
test("a recoverable navigation timeout still requires the expected URL and visible form", async () => {
  const h = harness({ recoverableNavigation: true });
  const run = h.start();
  await h.runs.settled(run.runId);
  assert.equal(h.runs.get(run.runId)?.status, "succeeded");
});
test("a DOM token mismatch never submits or retries", async () => {
  const h = harness({ invalidDom: true });
  const run = h.start();
  await h.runs.settled(run.runId);
  assert.equal(h.submissions.length, 0);
  assert.equal(h.runs.get(run.runId)?.error?.code, "TOKEN_DOM_ASSERTION_FAILED");
});
test("outcome checks reject a different host, path, scheme, or ambiguous result", async () => {
  for (const url of [
    "https://other.example.com/mock-merchant/authorize",
    "https://cards.example.com/wrong",
    "http://cards.example.com/mock-merchant/authorize",
    "https://cards.example.com:8443/mock-merchant/authorize",
    "https://cards.example.com/mock-merchant/authorize?unexpected=1",
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
