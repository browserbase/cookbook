/**
 * Control server for the flow.html demo
 * ======================================
 * Serves flow.html and actually RUNS the whole delegated-key flow when the page
 * asks. One button in the page → this server mints a JWT, spins up a Browserbase
 * session with the demo extension, returns the Live View URL (so the page can
 * embed it), then finishes the injection in the background while the page polls
 * for step progress.
 *
 * It spawns identity-provider.mjs + vault-server.mjs as children (same code the
 * CLI demo uses), so everything runs from one command:
 *
 *   BROWSERBASE_API_KEY=... node control.mjs
 *   → open http://localhost:8791
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import Browserbase from "@browserbasehq/sdk";
import { chromium } from "playwright-core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8791);
const API_KEY = process.env.BROWSERBASE_API_KEY;
const PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID; // your Browserbase project id
const IDP_BASE = "http://127.0.0.1:8790";
const VAULT_BASE = "http://127.0.0.1:8788";
const TARGET_URL = "https://the-internet.herokuapp.com/login";
const TARGET_HOST = "the-internet.herokuapp.com";
const AGENT_ID = "sample_org-agent-tax-2026";

const bb = new Browserbase({ apiKey: API_KEY });

// ── shared run state the page polls ──────────────────────────────────────────
let state = freshState();
let T0 = 0;
function freshState() {
  return {
    running: false,
    step: -1,
    liveViewUrl: null,
    sessionId: null,
    done: false,
    authenticated: false,
    error: null,
    log: [],
  };
}
function log(msg, kind = "info") {
  state.log.push({ ms: Date.now() - T0, msg, kind });
}
function setStep(n, msg) {
  state.step = n;
  if (msg) log(msg, "step");
}

// ── spawn IdP + vault children ───────────────────────────────────────────────
function waitHealthy(base, tries = 40) {
  return new Promise((resolve, reject) => {
    const tick = (i) => {
      http
        .get(`${base}/health`, (r) => {
          r.resume();
          resolve();
        })
        .on("error", () =>
          i < tries
            ? setTimeout(() => tick(i + 1), 200)
            : reject(new Error(`${base} not healthy`)),
        );
    };
    tick(0);
  });
}
async function startChildren() {
  spawn("node", [path.join(HERE, "identity-provider.mjs")], {
    env: { ...process.env, PORT: "8790" },
    stdio: "ignore",
  });
  spawn("node", [path.join(HERE, "vault-server.mjs")], {
    env: { ...process.env, PORT: "8788", IDP_BASE },
    stdio: "ignore",
  });
  await waitHealthy(IDP_BASE);
  await waitHealthy(VAULT_BASE);
}

// ── tiny JSON helpers ────────────────────────────────────────────────────────
function postJson(base, pathname, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(base + pathname);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(data),
          ...headers,
        },
      },
      (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () =>
          resolve({ status: r.statusCode, json: JSON.parse(d || "{}") }),
        );
      },
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}
function getLiveViewUrl(sessionId) {
  return new Promise((resolve) => {
    https_get(`https://www.browserbase.com/v1/sessions/${sessionId}/debug`, {
      "X-BB-API-Key": API_KEY,
    })
      .then((j) => resolve(j.debuggerFullscreenUrl))
      .catch(() => resolve(null));
  });
}
import https from "node:https";
function https_get(url, headers) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => {
          try {
            resolve(JSON.parse(d));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

// ── the actual flow ──────────────────────────────────────────────────────────
function bytes(b64) {
  return Buffer.from(b64, "base64").length;
}

function authenticatedDemoPage() {
  const visible = el => {
    if (!el || !el.getClientRects().length) return false;
    for (let node = el; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    }
    return true;
  };
  return location.origin === "https://the-internet.herokuapp.com" &&
    location.pathname === "/secure" &&
    [...document.querySelectorAll("h2")].some(el => visible(el) && el.textContent.trim() === "Secure Area") &&
    [...document.querySelectorAll('a[href="/logout"]')].some(visible) &&
    [...document.querySelectorAll("#flash.success")].some(el => visible(el) && el.textContent.includes("You logged into a secure area!")) &&
    ![...document.querySelectorAll('input[type="password"]')].some(visible);
}

async function runFlow() {
  state = freshState();
  state.running = true;
  T0 = Date.now();
  let browser;
  let session;
  let authenticated = false;
  try {
    // 0. mint JWT
    setStep(0, "① Mint JWT");
    log(
      "→ POST /token with the configured demo agent and target host",
      "send",
    );
    const tok = await postJson(IDP_BASE, "/token", {
      agentId: AGENT_ID,
      onBehalfOf: "user:jane@acme.com",
      host: TARGET_HOST,
      ttl: 300,
    });
    if (tok.status !== 200 || typeof tok.json?.token !== "string" || !tok.json.token) throw new Error("Token issuance failed");
    const jwt = tok.json.token;
    log("✓ Demo issuer returned a signed token", "ok");

    // 1. upload extension + create session
    setStep(1, "② Start cloud browser + load demo extension");
    const extZip = path.join(HERE, "_ext.zip");
    await zipDir(path.join(HERE, "extension"), extZip);
    const extension = await bb.extensions.create({
      file: fs.createReadStream(extZip),
    });
    log(
      "→ bb.extensions.create  → id " + extension.id.slice(0, 8) + "…",
      "send",
    );
    session = await bb.sessions.create({
      projectId: PROJECT_ID,
      extensionId: extension.id,
    });
    state.sessionId = session.id;
    state.liveViewUrl = await getLiveViewUrl(session.id);
    log(
      "✓ session live: " +
        session.id.slice(0, 8) +
        "…  (waiting for extension public key)",
      "ok",
    );

    await sleep(5500); // browser restarts to load the extension

    browser = await chromium.connectOverCDP(session.connectUrl);
    const ctx = browser.contexts()[0];
    const page = ctx.pages()[0];
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });
    log("→ navigated to " + TARGET_HOST + "/login", "send");

    // 2. wait for the extension to publish its public key
    setStep(2, "③ Browser generates a keypair, publishes its public key");
    let pubkey = null;
    for (let i = 0; i < 30 && !pubkey; i++) {
      pubkey = (await ctx.cookies(TARGET_URL)).find(
        (c) => c.name === "__rpass_session_pubkey__",
      )?.value;
      if (!pubkey) await sleep(300);
    }
    if (!pubkey) throw new Error("Timed out waiting for extension public key");
    pubkey = decodeURIComponent(pubkey);
    log(
      "✓ cookie __rpass_session_pubkey__ set by extension  (" +
        pubkey.length +
        " chars, private key stays in browser)",
      "ok",
    );
    await sleep(1200);

    // 3. request the wrapped lease
    setStep(3, "④ Ask the vault — JWT + public key");
    log(
      "→ POST /lease with token and caller-supplied recipient public key",
      "send",
    );
    await sleep(1000);

    // 4. vault wraps
    setStep(4, "⑤ Vault verifies JWT + wraps credential to the session key");
    const lease = await postJson(
      VAULT_BASE,
      "/lease",
      { hostname: TARGET_HOST, ttl: 120, sessionPublicKey: pubkey },
      { authorization: `Bearer ${jwt}` },
    );
    if (lease.status !== 200 || !["wrappedKey", "iv", "ciphertext"].every(key => typeof lease.json?.[key] === "string" && lease.json[key])) throw new Error("Vault did not return a wrapped lease");
    const env = lease.json;
    log("✓ vault verified JWT (signature + scope + expiry)", "ok");
    log(
      "✓ wrapped lease:  wrappedKey " +
        bytes(env.wrappedKey) +
        "B (RSA-OAEP) · ciphertext " +
        bytes(env.ciphertext) +
        "B (AES-256-GCM)",
      "ok",
    );
    log("✓ Received wrapped lease fields; recipient key is not session-attested", "ok");
    await sleep(1000);

    // 5. inject the wrapped lease
    setStep(5, "⑥ Deliver the sealed lockbox into the browser");
    await ctx.addCookies([
      {
        name: "__rpass_wrapped_lease__",
        value: JSON.stringify(env),
        domain: TARGET_HOST,
        path: "/",
        sameSite: "Lax",
      },
    ]);
    log(
      "→ set cookie __rpass_wrapped_lease__  (ciphertext only — demo.py holds no key)",
      "send",
    );

    // 6. wait for extension to decrypt + fill
    setStep(6, "⑦ Extension decrypts in-browser and fills the form");
    let filled = false,
      ul = 0,
      pl = 0;
    for (let i = 0; i < 20 && !filled; i++) {
      await sleep(400);
      ul = await page.evaluate(
        () => document.querySelector("#username")?.value?.length ?? 0,
      );
      pl = await page.evaluate(
        () => document.querySelector("#password")?.value?.length ?? 0,
      );
      filled = ul > 0 && pl > 0;
    }
    if (!filled) throw new Error("Timed out waiting for both login fields to be filled");
    log("✓ Observed nonempty username and password fields", "ok");

    setStep(7, "⑧ Submit and verify authenticated page");
    await page.click("button[type='submit']", { timeout: 10_000 });
    for (let i = 0; i < 40 && !authenticated; i++) {
      authenticated = await page.evaluate(authenticatedDemoPage);
      if (!authenticated) await sleep(250);
    }
    if (!authenticated) throw new Error("Timed out waiting for authenticated page evidence");
    log("✓ Observed secure page URL, success notice, heading and logout control", "ok");

  } catch (e) {
    state.error = String(e.message || e);
    log("✗ " + state.error, "err");
  } finally {
    for (const [label, cleanup] of [
      ["Browser disconnect", () => browser?.close()],
      ["Session release", () => session && bb.sessions.update(session.id, { projectId: PROJECT_ID, status: "REQUEST_RELEASE" })],
    ]) {
      try { await cleanup(); }
      catch {
        const message = `${label} failed`;
        state.error = state.error ? `${state.error}; ${message}` : message;
        log("✗ " + message, "err");
      }
    }
    state.authenticated = authenticated;
    state.done = authenticated && !state.error;
    state.running = false;
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// zip the extension dir using the system `zip` (present on macOS)
function zipDir(dir, out) {
  // use the system `zip` for reliability (present on macOS)
  return new Promise((resolve, reject) => {
    const files = fs.readdirSync(dir);
    const p = spawn("zip", [
      "-j",
      "-q",
      out,
      ...files.map((f) => path.join(dir, f)),
    ]);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error("zip failed")),
    );
    p.on("error", reject);
  });
}

// ── HTTP ─────────────────────────────────────────────────────────────────────
const MIME = {
  ".html": "text/html",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".css": "text/css",
  ".js": "text/javascript",
};
const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/run") {
    if (state.running) {
      res.writeHead(409, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: "already running" }));
    }
    runFlow(); // fire and forget
    // wait briefly for the live view url to appear
    for (let i = 0; i < 40 && !state.liveViewUrl && !state.error; i++)
      await sleep(200);
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(
      JSON.stringify({
        liveViewUrl: state.liveViewUrl,
        sessionId: state.sessionId,
        error: state.error,
      }),
    );
  }
  if (req.method === "GET" && req.url === "/status") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify(state));
  }
  // static files
  let rel = req.url.split("?")[0];
  if (rel === "/") rel = "/flow.html";
  const file = path.join(HERE, rel);
  if (
    file.startsWith(HERE) &&
    fs.existsSync(file) &&
    fs.statSync(file).isFile()
  ) {
    res.writeHead(200, {
      "content-type": MIME[path.extname(file)] || "application/octet-stream",
    });
    return fs.createReadStream(file).pipe(res);
  }
  res.writeHead(404);
  res.end("not found");
});

(async () => {
  if (!API_KEY || !PROJECT_ID) {
    console.error("Set BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID");
    process.exit(1);
  }
  await startChildren();
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`\n  ▶ Demo control server ready`);
    console.log(`     open  http://localhost:${PORT}\n`);
  });
})();
