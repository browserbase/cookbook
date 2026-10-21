import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createApp } from "../src/server.js";
import { config, encryptedCard, until, deferred } from "./fixtures.js";

async function fixture(options: Parameters<typeof createApp>[0] = {}) {
  const { app, runs } = createApp({ config, ...options });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  // Node fetch rewrites Host; use HTTP directly to test the real Host boundary.
  const request = (path: string, init: RequestInit = {}): Promise<Response> =>
    new Promise((resolve, reject) => {
      const headers = new Headers({ host: `127.0.0.1:${config.port}`, "x-demo-request": "1" });
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
      const request = httpRequest(
        {
          hostname: "127.0.0.1",
          port: address.port,
          path,
          method: init.method ?? "GET",
          headers: Object.fromEntries(headers),
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          response.on("end", () => {
            const responseHeaders = new Headers();
            for (const [key, value] of Object.entries(response.headers))
              if (value) responseHeaders.set(key, Array.isArray(value) ? value.join(", ") : value);
            resolve(
              new Response(Buffer.concat(chunks).toString(), {
                status: response.statusCode,
                headers: responseHeaders,
              }),
            );
          });
          response.on("error", reject);
        },
      );
      request.on("error", reject);
      request.end(init.body ? String(init.body) : undefined);
    });
  const close = async () => {
    await runs.shutdown();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
  return { request, runs, close };
}
const json = (value: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(value),
});

test("public merchant accepts only the synthetic fixture and never echoes submitted fields", async () => {
  const f = await fixture();
  try {
    for (const [number, cvc, status] of [
      ["4242424242424242", "123", 200],
      ["4000000000000002", "987", 422],
    ] as const) {
      const response = await f.request("/mock-merchant/authorize", {
        method: "POST",
        headers: {
          host: config.cardTargetHost,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ number, cvc, expiry: "12/34" }),
      });
      assert.equal(response.status, status);
      const body = await response.text();
      assert.ok(!body.includes(number));
      assert.ok(!body.includes(cvc));
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
    const response = await f.request("/mock-merchant/authorize", json({ number: "private-value" }));
    assert.equal(response.status, 415);
  } finally {
    await f.close();
  }
});

test("local page/API deny a public Host, hostile Origin, cross-site request, and missing custom header", async () => {
  const f = await fixture();
  try {
    const blockedHeaders: Record<string, string>[] = [
      { host: config.cardTargetHost },
      { origin: "https://other.example.com" },
      { "sec-fetch-site": "cross-site" },
      { "x-demo-request": "" },
    ];
    for (const headers of blockedHeaders) {
      const response = await f.request("/api/config", { headers });
      assert.equal(response.status, 403);
      assert.ok(!(await response.text()).includes(config.evervaultApiKey));
    }
    const response = await f.request("/api/config");
    assert.equal(response.status, 200);
    const publicBody = await response.json();
    assert.equal(publicBody.teamId, config.evervaultTeamId);
    assert.ok(!JSON.stringify(publicBody).includes(config.browserbaseApiKey));
    assert.equal((await f.request("/", { headers: { host: config.cardTargetHost } })).status, 403);
    assert.equal((await f.request("/.env")).status, 404);
    assert.equal(
      (await f.request("/mock-merchant/checkout", { headers: { host: config.cardTargetHost } }))
        .status,
      200,
    );
    assert.equal(
      (await f.request("/merchant.css", { headers: { host: config.cardTargetHost } })).status,
      200,
    );
  } finally {
    await f.close();
  }
});

test("malformed, plaintext, oversized, or wrong-expiry card requests never start an executor", async () => {
  let starts = 0;
  const f = await fixture({
    executor: () => async () => {
      starts++;
    },
  });
  try {
    for (const payload of [
      {},
      { encryptedCard: { number: "4242424242424242", cvc: "123" } },
      { encryptedCard: encryptedCard(), expiry: { month: "01", year: "30" } },
    ]) {
      assert.equal((await f.request("/api/card-runs", json(payload))).status, 400);
    }
    const malformed = await f.request("/api/card-runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"private-value":',
    });
    assert.equal(malformed.status, 400);
    assert.ok(!(await malformed.text()).includes("private-value"));
    assert.equal(
      (await f.request("/api/card-runs", json({ value: "x".repeat(15_000) }))).status,
      400,
    );
    assert.equal(starts, 0);
  } finally {
    await f.close();
  }
});

test("local API exposes automatic progress, tokens, safe results, and rejects concurrent starts", async () => {
  const blocked = deferred();
  const f = await fixture({
    executor: () => async (context) => {
      context.update({
        progress: "Opening synthetic checkouts",
        displayCardTokens: { number: "4000000000000002", cvc: "987" },
      });
      await blocked.promise;
      context.update({
        cleanupStatus: "completed",
        proxiedOutcome: "approved",
        controlOutcome: "rejected_as_expected",
      });
    },
  });
  try {
    const response = await f.request(
      "/api/card-runs",
      json({ encryptedCard: encryptedCard(), expiry: { month: "12", year: "34" } }),
    );
    assert.equal(response.status, 202);
    const { runId } = await response.json();
    await until(() => Boolean(f.runs.get(runId)?.displayCardTokens));
    const active = await (await f.request(`/api/runs/${runId}`)).json();
    assert.equal(active.displayCardTokens.number, "4000000000000002");
    for (const excluded of ["events", "awaitingAction", "proxiedLiveViewUrl", "controlLiveViewUrl"])
      assert.ok(!(excluded in active));
    assert.equal(
      (
        await f.request(
          "/api/card-runs",
          json({ encryptedCard: encryptedCard(), expiry: { month: "12", year: "34" } }),
        )
      ).status,
      409,
    );
    assert.equal(
      (await f.request(`/api/runs/${runId}/advance`, json({ action: "enter_token" }))).status,
      404,
    );
    blocked.resolve();
    await f.runs.settled(runId);
    const state = await (await f.request(`/api/runs/${runId}`)).json();
    assert.equal(state.status, "succeeded");
    assert.equal(state.proxiedOutcome, "approved");
    assert.equal(state.displayCardTokens, undefined);
    assert.ok(!JSON.stringify(state).includes("ev:"));
    assert.equal((await f.request("/api/runs/missing")).status, 404);
  } finally {
    blocked.resolve();
    await f.close();
  }
});

test("local Cancel route waits for in-flight work to settle before reporting cleanup", async () => {
  const blocked = deferred();
  let entered = false;
  const f = await fixture({
    executor: () => async (context) => {
      entered = true;
      await blocked.promise;
      assert.equal(context.signal.aborted, true);
      context.update({ cleanupStatus: "completed" });
    },
  });
  try {
    const { runId } = await (
      await f.request(
        "/api/card-runs",
        json({ encryptedCard: encryptedCard(), expiry: { month: "12", year: "34" } }),
      )
    ).json();
    await until(() => entered);
    assert.equal((await f.request(`/api/runs/${runId}/stop`, json({}))).status, 202);
    assert.equal(f.runs.get(runId)?.status, "stopping");
    blocked.resolve();
    await f.runs.settled(runId);
    assert.equal(f.runs.get(runId)?.status, "stopped");
    assert.equal(f.runs.get(runId)?.cleanupStatus, "completed");
    assert.equal((await f.request("/api/runs/missing/stop", json({}))).status, 404);
  } finally {
    blocked.resolve();
    await f.close();
  }
});

test("local UI assets load with a restrictive CSP, system fonts, and no captured data", async () => {
  const f = await fixture();
  try {
    const response = await f.request("/");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-security-policy")!, /frame-ancestors 'self'/);
    const html = await response.text();
    assert.match(html, /Evervault/);
    assert.match(html, /Run comparison/);
    assert.match(html, /Returned Browser Tokens/);
    assert.ok(!html.includes("fullscreen"));
    assert.ok(!html.includes("proxied-view"));
    for (const path of ["/app.js", "/styles.css"])
      assert.equal((await f.request(path)).status, 200);
    const css = await (await f.request("/styles.css")).text();
    assert.ok(!css.includes("@font-face"));
    const proxy = await readFile(new URL("../Caddyfile.example", import.meta.url), "utf8");
    assert.match(proxy, /respond "Not found" 404/);
    assert.match(proxy, /header_up Host \{host\}/);
    assert.ok(!proxy.includes("/api"));
  } finally {
    await f.close();
  }
});
