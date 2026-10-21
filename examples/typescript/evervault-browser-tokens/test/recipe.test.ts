import assert from "node:assert/strict";
import test from "node:test";
import { request } from "node:http";
import { createServer } from "node:net";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkout, main, type Runtime } from "../index.js";
import { createFixture, startFixture } from "../local.js";
import {
  createCardBrowserTokens,
  loadConfig,
  parseCardBrowserTokens,
  safeMessage,
  type AppConfig,
} from "../evervault.js";
import { setup } from "../scripts/setup.js";

// Entirely synthetic credentials, ciphertext and tokens; no provider calls in these tests.
const env = {
  EVERVAULT_TEAM_ID: "fixture-team",
  EVERVAULT_APP_ID: "fixture-app",
  EVERVAULT_API_KEY: "fixture-evervault-key",
  BROWSERBASE_API_KEY: "fixture-browser-key",
  BROWSERBASE_CA_CERTIFICATE_ID: "fixture-ca",
  CARD_TARGET_HOST: "cards.example.com",
  PORT: "4173",
};
const config = loadConfig(env, true);
const card = () => ({ number: `ev:${"n".repeat(24)}`, cvc: `ev:${"c".repeat(24)}` });
const rawTokens = () => ({
  data: [
    { id: "demo-card-number", value: "4000000000000002" },
    { id: "demo-card-cvc", value: "987" },
  ],
  proxyConfiguration: {
    hostname: "fixture.browser.relay.evervault.app",
    port: 443,
    username: "fixture-user",
    password: "fixture-proxy-value",
  },
});
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
test("configuration requires reader credentials, exact DNS host and valid local port", () => {
  assert.equal(config.cardTargetHost, "cards.example.com");
  assert.equal(loadConfig({ ...env, BROWSERBASE_CA_CERTIFICATE_ID: "" }).caCertificateId, "");
  for (const name of Object.keys(env).filter((name) => name !== "PORT")) {
    assert.throws(() => loadConfig({ ...env, [name]: "<placeholder>" }, true));
  }
  for (const host of [
    "localhost",
    "a.local",
    "a.localhost",
    "*.example.com",
    "https://cards.example.com",
    "cards.example.com:443",
    "1.2.3.4",
    "cards.example.com/path",
  ]) {
    assert.throws(() => loadConfig({ ...env, CARD_TARGET_HOST: host }, true));
  }
  for (const port of ["0", "65536", "1.5", "invalid"])
    assert.throws(() => loadConfig({ ...env, PORT: port }));
});
test("token request uses encrypted values, exact decrypt policy, TTL 300 and bounded abort signal", async () => {
  let calls = 0;
  const before = Date.now();
  const tokens = await createCardBrowserTokens(config, card(), config.cardTargetHost, {
    fetch: (async (url, options) => {
      calls++;
      assert.equal(url, "https://api.evervault.com/browser-tokens");
      assert.equal(options?.method, "POST");
      assert.ok(options?.signal);
      assert.deepEqual(JSON.parse(String(options?.body)), {
        data: [
          { id: "demo-card-number", category: "card.number", value: card().number },
          { id: "demo-card-cvc", category: "card.cvv", value: card().cvc },
        ],
        permissions: [{ action: "decrypt", target: config.cardTargetHost }],
        ttl: 300,
      });
      return Response.json(rawTokens());
    }) as typeof fetch,
  });
  assert.equal(calls, 1);
  assert.ok(Date.parse(tokens.expiresAt) >= before + 300_000);
});
test("invalid ciphertext, target, token response and upstream errors are rejected without disclosure", async () => {
  for (const values of [
    { number: "4242424242424242", cvc: "123" },
    { number: "ev:short", cvc: "ev:short" },
  ])
    await assert.rejects(() => createCardBrowserTokens(config, values, config.cardTargetHost));
  await assert.rejects(() => createCardBrowserTokens(config, card(), "other.example.com"));
  for (const raw of [
    null,
    {},
    { data: "private-provider-detail" },
    {
      ...rawTokens(),
      proxyConfiguration: { ...rawTokens().proxyConfiguration, hostname: "evil.example.com" },
    },
    { ...rawTokens(), data: [{ id: "demo-card-number", value: "not-a-token" }] },
  ]) {
    await assert.rejects(() =>
      createCardBrowserTokens(config, card(), config.cardTargetHost, {
        fetch: (async () => Response.json(raw)) as typeof fetch,
      }),
    );
  }
  let reads = 0;
  await assert.rejects(
    () =>
      createCardBrowserTokens(config, card(), config.cardTargetHost, {
        fetch: (async () => ({
          ok: false,
          json: () => {
            reads++;
            throw new Error("private-provider-detail");
          },
        })) as unknown as typeof fetch,
      }),
    /Evervault rejected/,
  );
  assert.equal(reads, 0);
  assert.ok(!safeMessage(new Error("private-provider-detail")).includes("private-provider-detail"));
  assert.throws(() => parseCardBrowserTokens(rawTokens(), new Date(0).toISOString()), /expired/);
});

type Phase = "tokens" | "launch" | "attach" | "page" | "navigate" | "fill" | "submit";
function harness(
  options: {
    pause?: Phase;
    expireAt?: Phase;
    fail?: Phase | "close" | "release" | "confirmation";
    wrongUrl?: boolean;
    decline?: boolean;
  } = {},
) {
  const blocked = deferred(),
    entered = deferred();
  const abort = new AbortController();
  const values = card();
  const tokens = parseCardBrowserTokens(rawTokens(), new Date(Date.now() + 300_000).toISOString());
  const launches: Parameters<Runtime["launch"]>[0][] = [],
    fills: string[] = [],
    released: string[] = [],
    logs: string[] = [];
  let submissions = 0,
    browserClosed = 0,
    attachedClosed = 0;
  const boundary = async (phase: Phase) => {
    if (options.pause === phase) {
      entered.resolve();
      await blocked.promise;
    }
    if (options.expireAt === phase) tokens.expiresAt = new Date(0).toISOString();
    if (options.fail === phase) throw new Error("private-provider-detail");
  };
  const page = {
    goto: async () => {
      await boundary("navigate");
    },
    waitForSelector: async (selector: string) => {
      if (options.decline && selector.includes("approved"))
        throw new Error("private-provider-detail");
    },
    url: async () =>
      `https://${options.wrongUrl ? "wrong.example.com" : config.cardTargetHost}/mock-merchant/${submissions ? "authorize" : "checkout"}`,
    locator: (selector: string) => ({
      fill: async (value: string) => {
        fills.push(value);
        await boundary("fill");
      },
      click: async () => {
        assert.equal(selector, 'button[type="submit"]');
        submissions++;
        await boundary("submit");
      },
    }),
  };
  const browser = {
    sessionId: "fixture-session" as string | undefined,
    closed: false,
    context: {
      activePage: async () => {
        await boundary("page");
        return page;
      },
    },
    close: async () => {
      browserClosed++;
      browser.closed = true;
      browser.sessionId = undefined;
      if (options.fail === "close") throw new Error("private-provider-detail");
    },
  };
  const runtime: Runtime = {
    tokens: async () => {
      await boundary("tokens");
      return tokens;
    },
    launch: (async (settings: Parameters<Runtime["launch"]>[0]) => {
      launches.push(settings);
      await boundary("launch");
      return browser;
    }) as unknown as Runtime["launch"],
    attach: (async (settings) => {
      assert.deepEqual(settings.logging, { level: "off" });
      await boundary("attach");
      return {
        close: async () => {
          attachedClosed++;
        },
      };
    }) as Runtime["attach"],
    release: async (id) => {
      released.push(id);
      if (options.fail === "release") throw new Error("private-provider-detail");
    },
    retrieve: async () => ({ status: options.fail === "confirmation" ? "ERROR" : "COMPLETED" }),
  };
  return {
    runtime,
    abort,
    tokens,
    values,
    entered: entered.promise,
    unblock: blocked.resolve,
    launches,
    fills,
    released,
    logs,
    counts: () => ({ submissions, browserClosed, attachedClosed }),
    run: () => checkout(config, values, abort.signal, runtime, (message) => logs.push(message), 1),
  };
}
test("one proxied session submits tokens once, asserts approval and releases the captured session ID", async () => {
  const h = harness();
  await h.run();
  assert.equal(h.launches.length, 1);
  const launch = h.launches[0]!;
  assert.equal(launch.api_timeout, 240);
  assert.equal(launch.keepAlive, false);
  assert.deepEqual(launch.browserSettings?.allowedDomains, [config.cardTargetHost]);
  assert.equal(launch.browserSettings?.recordSession, false);
  assert.equal(launch.browserSettings?.logSession, false);
  assert.equal(launch.browserSettings?.ignoreCertificateErrors, false);
  assert.deepEqual(launch.proxySettings, { caCertificates: [config.caCertificateId] });
  assert.deepEqual(launch.proxies, [
    {
      type: "external",
      server: "https://fixture.browser.relay.evervault.app:443",
      username: "fixture-user",
      password: "fixture-proxy-value",
    },
  ]);
  assert.deepEqual(h.fills, [h.tokens.numberToken, "12/34", h.tokens.cvcToken]);
  assert.deepEqual(h.counts(), { submissions: 1, browserClosed: 1, attachedClosed: 1 });
  assert.deepEqual(h.released, ["fixture-session"]);
  assert.deepEqual(h.values, { number: "", cvc: "" });
  for (const sensitive of [
    card().number,
    h.tokens.numberToken,
    h.tokens.cvcToken,
    "fixture-proxy-value",
    "fixture-session",
    env.BROWSERBASE_API_KEY,
  ])
    assert.ok(!h.logs.join(" ").includes(sensitive));
});
for (const phase of ["tokens", "launch", "attach", "page", "navigate", "fill"] as const) {
  test(`cancellation during ${phase} waits for acquisition and prevents submission`, async () => {
    const h = harness({ pause: phase });
    const pending = h.run();
    await h.entered;
    h.abort.abort();
    let settled = false;
    void pending.catch(() => {
      settled = true;
    });
    await Promise.resolve();
    assert.equal(settled, false);
    h.unblock();
    await assert.rejects(pending);
    assert.equal(h.counts().submissions, 0);
    assert.equal(h.released.length, phase === "tokens" ? 0 : 1);
    assert.deepEqual(h.values, { number: "", cvc: "" });
  });
}
test("cancellation cannot undo an already-started submission but still releases resources", async () => {
  const h = harness({ pause: "submit" });
  const pending = h.run();
  await h.entered;
  h.abort.abort();
  h.unblock();
  await assert.rejects(pending);
  assert.equal(h.counts().submissions, 1);
  assert.equal(h.released.length, 1);
});
for (const phase of ["tokens", "navigate", "fill"] as const) {
  test(`expiry after ${phase} blocks submission`, async () => {
    const h = harness({ expireAt: phase });
    await assert.rejects(h.run(), /expired/);
    assert.equal(h.counts().submissions, 0);
    assert.equal(h.released.length, phase === "tokens" ? 0 : 1);
  });
}
for (const failure of [
  "launch",
  "attach",
  "navigate",
  "close",
  "release",
  "confirmation",
] as const) {
  test(`failure at ${failure} attempts every acquired resource and never claims success`, async () => {
    const h = harness({ fail: failure });
    await assert.rejects(h.run());
    assert.equal(h.released.length, failure === "launch" ? 0 : 1);
    assert.equal(h.counts().browserClosed, failure === "launch" ? 0 : 1);
    assert.ok(!h.logs.join(" ").includes("private-provider-detail"));
  });
}
test("cleanup failure takes precedence over cancellation", async () => {
  const h = harness({ pause: "navigate", fail: "release" });
  const pending = h.run();
  await h.entered;
  h.abort.abort();
  h.unblock();
  await assert.rejects(pending, /Cleanup could not be confirmed/);
});
test("unexpected destination and nonapproval are failures", async () => {
  await assert.rejects(harness({ wrongUrl: true }).run(), /destination/);
  await assert.rejects(harness({ decline: true }).run());
});

async function httpFixture() {
  const controller = new AbortController();
  const fixture = createFixture(config, controller.signal);
  const server = fixture.app.listen(0, "127.0.0.1");
  await new Promise<void>((done) => server.once("listening", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    ...fixture,
    controller,
    port: address.port,
    close: () =>
      new Promise<void>((done) => {
        server.close(() => done());
        server.closeAllConnections();
      }),
  };
}
function call(
  port: number,
  path: string,
  method = "GET",
  body?: string,
  headers: Record<string, string | undefined> = {},
) {
  return new Promise<{ status: number; body: string; headers: Record<string, unknown> }>(
    (resolve, reject) => {
      const req = request(
        {
          hostname: "127.0.0.1",
          port,
          path,
          method,
          headers: {
            host: "127.0.0.1:4173",
            "x-demo-request": "1",
            "content-type": "application/json",
            ...headers,
          },
        },
        (response) => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            body += chunk;
          });
          response.on("end", () =>
            resolve({ status: response.statusCode!, body, headers: response.headers }),
          );
        },
      );
      req.on("error", reject);
      req.end(body);
    },
  );
}
test("ciphertext handoff is single-use, including concurrent submissions; malformed input is not accepted", async () => {
  const f = await httpFixture();
  try {
    for (const body of [
      "{}",
      "null",
      "{",
      JSON.stringify({ number: "4242424242424242", cvc: "123" }),
      JSON.stringify({ ...card(), unexpected: "private-input" }),
      JSON.stringify({ ...card(), number: `ev:${"x".repeat(13000)}` }),
    ]) {
      const result = await call(f.port, "/api/collect", "POST", body);
      assert.equal(result.status, 400);
      assert.ok(!result.body.includes("private-input"));
    }
    const result = await Promise.all([
      call(f.port, "/api/collect", "POST", JSON.stringify(card())),
      call(f.port, "/api/collect", "POST", JSON.stringify(card())),
    ]);
    assert.deepEqual(result.map((r) => r.status).sort(), [202, 409]);
    assert.deepEqual(await f.card, card());
    assert.ok(!result.some((r) => r.body.includes(card().number)));
  } finally {
    await f.close();
  }
});
test("HTTP isolation denies public page/API, cross-site requests, missing header, private files and removed app routes", async () => {
  const f = await httpFixture();
  try {
    for (const headers of [
      { host: "cards.example.com" },
      { origin: "https://evil.example.com" },
      { "sec-fetch-site": "cross-site" },
      { "x-demo-request": "" },
    ])
      assert.equal((await call(f.port, "/api/config", "GET", undefined, headers)).status, 403);
    const publicConfig = await call(f.port, "/api/config");
    assert.deepEqual(JSON.parse(publicConfig.body), {
      teamId: config.evervaultTeamId,
      appId: config.evervaultAppId,
    });
    assert.equal(publicConfig.headers["cache-control"], "no-store");
    for (const path of ["/.env", "/api/runs/old", "/api/card-runs", "/merchant.css", "/styles.css"])
      assert.equal((await call(f.port, path)).status, 404);
    assert.equal(
      (
        await call(f.port, "/mock-merchant/checkout", "GET", undefined, {
          host: "cards.example.com",
        })
      ).status,
      200,
    );
    f.controller.abort();
    assert.equal((await call(f.port, "/api/collect", "POST", JSON.stringify(card()))).status, 409);
  } finally {
    await f.close();
  }
});
test("synthetic merchant approves only the public fixture, never echoes submitted values and rejects other content types", async () => {
  const f = await httpFixture();
  try {
    const approved = await call(
      f.port,
      "/mock-merchant/authorize",
      "POST",
      "number=4242424242424242&cvc=123&expiry=12%2F34",
      { "content-type": "application/x-www-form-urlencoded", host: "cards.example.com" },
    );
    assert.equal(approved.status, 200);
    assert.match(approved.body, /data-outcome="approved"/);
    const declined = await call(
      f.port,
      "/mock-merchant/authorize",
      "POST",
      "number=private-input&cvc=987&expiry=12%2F34",
      { "content-type": "application/x-www-form-urlencoded" },
    );
    assert.equal(declined.status, 422);
    assert.ok(!declined.body.includes("private-input"));
    assert.equal((await call(f.port, "/mock-merchant/authorize", "POST", "{}")).status, 415);
  } finally {
    await f.close();
  }
});
async function freePort() {
  const server = createServer().listen(0, "127.0.0.1");
  await new Promise<void>((done) => server.once("listening", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  test(`${signal} during collection closes the server and exits without a session`, async () => {
    const port = await freePort(),
      ready = deferred();
    const h = harness(),
      messages: string[] = [];
    const pending = main({ ...config, port }, h.runtime, (message) => {
      messages.push(message);
      if (message.startsWith("Open")) ready.resolve();
    });
    await ready.promise;
    process.emit(signal);
    assert.equal(await pending, signal === "SIGINT" ? 130 : 143);
    assert.equal(h.launches.length, 0);
    await assert.rejects(fetch(`http://127.0.0.1:${port}`));
    assert.ok(!messages.join(" ").includes("Success:"));
  });
}
test("cancelling collection closes even an unfinished HTTP request", async () => {
  const port = await freePort(),
    controller = new AbortController();
  const fixture = await startFixture({ ...config, port }, controller.signal);
  const req = request({
    hostname: "127.0.0.1",
    port,
    path: "/api/collect",
    method: "POST",
    headers: {
      host: `127.0.0.1:${port}`,
      "x-demo-request": "1",
      "content-type": "application/json",
      "content-length": "1000",
    },
  });
  req.on("error", () => {});
  req.write("{");
  controller.abort();
  await assert.rejects(fixture.card);
  await fixture.close();
  req.destroy();
  await assert.rejects(fetch(`http://127.0.0.1:${port}`));
});
test("collection-to-terminal success keeps the merchant alive through cleanup, then closes the server", async () => {
  const port = await freePort(),
    ready = deferred();
  const h = harness(),
    messages: string[] = [];
  h.runtime.retrieve = async () => {
    assert.equal((await fetch(`http://127.0.0.1:${port}/mock-merchant/checkout`)).status, 200);
    return { status: "COMPLETED" };
  };
  const pending = main({ ...config, port }, h.runtime, (message) => {
    messages.push(message);
    if (message.startsWith("Open")) ready.resolve();
  });
  await ready.promise;
  const response = await call(port, "/api/collect", "POST", JSON.stringify(card()), {
    host: `127.0.0.1:${port}`,
  });
  assert.equal(response.status, 202);
  assert.equal(await pending, 0);
  assert.equal(messages.at(-1), "Success: synthetic approval and cleanup confirmed.");
  await assert.rejects(fetch(`http://127.0.0.1:${port}`));
});
test("provider failure is sanitized in terminal output and exits nonzero", async () => {
  const port = await freePort(),
    ready = deferred();
  const h = harness({ fail: "attach" }),
    messages: string[] = [];
  const pending = main({ ...config, port }, h.runtime, (message) => {
    messages.push(message);
    if (message.startsWith("Open")) ready.resolve();
  });
  await ready.promise;
  await call(port, "/api/collect", "POST", JSON.stringify(card()), { host: `127.0.0.1:${port}` });
  assert.equal(await pending, 1);
  assert.ok(!messages.join(" ").includes("private-provider-detail"));
  assert.ok(!messages.join(" ").includes("Success:"));
});
test("CA setup reuses accessible certificates without downloading or writing .env", async () => {
  let calls = 0;
  const id = await setup(
    config,
    {
      certificates: {
        retrieve: async (id: string) => {
          calls++;
          assert.equal(id, config.caCertificateId);
        },
      },
    } as never,
    (async () => {
      throw new Error("Must not fetch an accessible CA");
    }) as typeof fetch,
  );
  assert.equal(id, config.caCertificateId);
  assert.equal(calls, 1);
});
test("CA setup validates, uploads an inaccessible or absent CA, and rejects malformed/non-CA/expired material", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "evervault-ca-test-"));
  try {
    const key = join(directory, "key.pem"),
      cert = join(directory, "ca.pem");
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        key,
        "-out",
        cert,
        "-days",
        "1",
        "-subj",
        "/CN=Offline Fixture CA",
        "-addext",
        "basicConstraints=critical,CA:TRUE",
      ],
      { stdio: "ignore" },
    );
    const pem = await readFile(cert, "utf8");
    let uploads = 0;
    const client = {
      certificates: {
        retrieve: async () => {
          throw new Error("inaccessible");
        },
        create: async () => {
          uploads++;
          return { id: "fixture-upload" };
        },
      },
    };
    assert.equal(
      await setup(config, client as never, (async () => new Response(pem)) as typeof fetch),
      "fixture-upload",
    );
    assert.equal(uploads, 1);
    for (const material of ["not a certificate", ""])
      await assert.rejects(() =>
        setup(
          { ...config, caCertificateId: "" },
          client as never,
          (async () => new Response(material)) as typeof fetch,
        ),
      );
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        key,
        "-out",
        cert,
        "-days",
        "1",
        "-subj",
        "/CN=Offline Non-CA",
        "-addext",
        "basicConstraints=critical,CA:FALSE",
      ],
      { stdio: "ignore" },
    );
    const nonCa = await readFile(cert, "utf8");
    await assert.rejects(() =>
      setup(
        { ...config, caCertificateId: "" },
        client as never,
        (async () => new Response(nonCa)) as typeof fetch,
      ),
    );
    t.mock.timers.enable({ apis: ["Date"], now: Date.now() + 2 * 86_400_000 });
    await assert.rejects(() =>
      setup(
        { ...config, caCertificateId: "" },
        client as never,
        (async () => new Response(pem)) as typeof fetch,
      ),
    );
    assert.equal(uploads, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("recipe stays within the reviewed file and source budgets", async () => {
  const files = [
    "index.ts",
    "evervault.ts",
    "local.ts",
    "scripts/setup.ts",
    "public/index.html",
    "public/collect.js",
  ];
  const source = await Promise.all(
    files.map((file) => readFile(new URL(`../${file}`, import.meta.url), "utf8")),
  );
  assert.ok(source[0]!.trimEnd().split("\n").length <= 200);
  assert.ok(
    source.reduce(
      (count, text) => count + text.split("\n").filter((line) => line.trim()).length,
      0,
    ) <= 600,
  );
});
