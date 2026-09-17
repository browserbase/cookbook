import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";

const base = new URL("../", import.meta.url);
const token = "synthetic-export-token-123456789";

function source(path) {
  return stripTypeScriptTypes(readFileSync(new URL(path, base), "utf8"))
    .replace(/^import .*;\s*$/gm, "")
    .replace(/^export /gm, "");
}

async function runRoute(kind, { authorization = `Bearer ${token}`, connectFailure = false } = {}) {
  const calls = { create: 0, connect: 0, close: 0, release: 0, goto: [] };
  const page = {
    goto: async (url) => calls.goto.push(url),
    evaluate: async () => "<html><body>fixture</body></html>",
    screenshot: async () => new Uint8Array([1, 2, 3]),
  };
  const browser = { newPage: async () => page, close: async () => { calls.close++; } };
  class Browserbase {
    sessions = {
      create: async () => { calls.create++; return { id: "session-fixture", connectUrl: "wss://fixture.invalid" }; },
      update: async () => { calls.release++; },
    };
  }
  const context = vm.createContext({
    Buffer, Date, Headers, Request, Response, URL, console: { error() {} },
    process: { env: { EXPORT_API_TOKEN: token, BROWSERBASE_API_KEY: "synthetic", } },
    timingSafeEqual: (left, right) => Buffer.compare(left, right) === 0,
    Browserbase,
    puppeteer: { connect: async () => { calls.connect++; if (connectFailure) throw Error("fixture"); return browser; } },
    prettier: { format: async value => value }, htmlParser: {},
    NextResponse: class extends Response { static json(body, init) { return Response.json(body, init); } },
  });
  vm.runInContext(`${source("lib/request-guard.ts")}\n${source(`app/api/${kind}/route.ts`)}`, context);
  const request = new Request(`https://local.invalid/api/${kind}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization, "x-real-ip": `${kind}-${Math.random()}` },
    body: JSON.stringify({ url: "https://example.com/path" }),
  });
  return { response: await context.POST(request), calls };
}

for (const kind of ["html", "screenshot"]) {
  test(`${kind} rejects unauthenticated requests before browser allocation`, async () => {
    const result = await runRoute(kind, { authorization: "" });
    assert.equal(result.response.status, 401);
    assert.equal(result.calls.create, 0);
  });

  test(`${kind} uses POST body and closes a connected browser`, async () => {
    const result = await runRoute(kind);
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.calls.goto, ["https://example.com/path"]);
    assert.equal(result.calls.close, 1);
  });

  test(`${kind} requests release when CDP connection fails`, async () => {
    const result = await runRoute(kind, { connectFailure: true });
    assert.equal(result.response.status, 500);
    assert.equal(result.calls.release, 1);
  });
}

test("guard rejects unsafe targets and limits concurrent work", async () => {
  const context = vm.createContext({ Buffer, Date, Request, Response, URL,
    process: { env: { EXPORT_API_TOKEN: token } },
    timingSafeEqual: (left, right) => Buffer.compare(left, right) === 0 });
  vm.runInContext(source("lib/request-guard.ts"), context);
  const request = body => new Request("https://local.invalid/api/html", {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-real-ip": "limit-fixture" }, body: JSON.stringify(body),
  });
  const unsafe = await context.readExportUrl(request({ url: "http://example.com" }));
  assert.equal(unsafe.status, 400);
  const first = context.acquireBrowserRequest(request({ url: "https://example.com" }));
  const second = context.acquireBrowserRequest(request({ url: "https://example.com" }));
  const third = context.acquireBrowserRequest(request({ url: "https://example.com" }));
  assert.equal(typeof first, "function");
  assert.equal(typeof second, "function");
  assert.equal(third.status, 429);
  first(); second();
});
