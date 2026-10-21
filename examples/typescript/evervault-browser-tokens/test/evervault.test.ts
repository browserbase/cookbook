import assert from "node:assert/strict";
import test from "node:test";
import { createCardBrowserTokens, parseCardBrowserTokens } from "../src/evervault.js";
import { safeError } from "../src/sanitize.js";
import { config, encryptedCard, rawTokens } from "./fixtures.js";

test("requests both encrypted card fields with one exact decrypt permission and a five-minute TTL", async () => {
  let calls = 0;
  const tokens = await createCardBrowserTokens(config, encryptedCard(), config.cardTargetHost, {
    fetch: (async (url, options) => {
      calls++;
      assert.equal(url, "https://api.evervault.com/browser-tokens");
      const body = JSON.parse(String(options?.body));
      assert.deepEqual(body.permissions, [{ action: "decrypt", target: config.cardTargetHost }]);
      assert.equal(body.ttl, 300);
      assert.deepEqual(
        body.data.map((field: { category: string }) => field.category),
        ["card.number", "card.cvv"],
      );
      assert.ok(body.data.every((field: { value: string }) => field.value.startsWith("ev:")));
      return Response.json(rawTokens());
    }) as typeof fetch,
  });
  assert.equal(calls, 1);
  assert.equal(tokens.cvcToken, "987");
});
test("does not retry rejected requests or expose provider error bodies", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      createCardBrowserTokens(config, encryptedCard(), config.cardTargetHost, {
        fetch: (async () => {
          calls++;
          return Response.json({ message: "private-provider-detail" }, { status: 400 });
        }) as typeof fetch,
      }),
    (error: unknown) => {
      assert.ok(!JSON.stringify(safeError(error)).includes("private-provider-detail"));
      return true;
    },
  );
  assert.equal(calls, 1);
});
test("rejects plaintext, target changes, missing tokens, expired tokens, and invalid proxy addresses", async () => {
  await assert.rejects(() =>
    createCardBrowserTokens(
      config,
      { number: "4242424242424242", cvc: "123" },
      config.cardTargetHost,
    ),
  );
  await assert.rejects(() => createCardBrowserTokens(config, encryptedCard(), "other.example.com"));
  const expiry = new Date(Date.now() + 300_000).toISOString();
  assert.throws(() => parseCardBrowserTokens({ data: [] }, expiry));
  assert.throws(() => parseCardBrowserTokens(rawTokens(), new Date(0).toISOString()));
  for (const hostname of [
    "127.0.0.1",
    "relay.evervault.app.attacker.example",
    "https://fixture.evervault.app",
  ]) {
    const raw = rawTokens();
    raw.proxyConfiguration.hostname = hostname;
    assert.throws(() => parseCardBrowserTokens(raw, expiry));
  }
});
test("unknown SDK errors never return headers, bodies, or credential-shaped strings", () => {
  const error = new Error(
    "Bearer private-value; Basic private-value; ev:private-value; wss://private.example",
  );
  assert.equal(safeError(error).code, "RUN_FAILED");
  assert.ok(!JSON.stringify(safeError(error)).includes("private-value"));
});
