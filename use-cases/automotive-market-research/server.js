const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { randomUUID } = require("crypto");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const controlToken = randomUUID();
const localHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
const publicAssets = new Set(["/index.html", "/app.js", "/styles.css", "/assets/browserbase-logo.png"]);
const agentConfigPath = path.join(root, ".browserbase-agent.json");
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const BB_API = "https://api.browserbase.com";
let tunnel;
let tunnelStarting;

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error("Request too large"));
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function bbFetch(apiPath, options = {}) {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey)
    throw new Error("BROWSERBASE_API_KEY is not configured on the demo server");
  const response = await fetch(`${BB_API}${apiPath}`, {
    ...options,
    headers: {
      "x-bb-api-key": apiKey,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text };
  }
  if (!response.ok)
    throw new Error(
      body.message ||
        body.error ||
        `Browserbase request failed (${response.status})`,
    );
  return body;
}

function createTunnelProxy(secret) {
  return http.createServer((req, res) => {
    let url;
    try { url = new URL(req.url, "http://localhost"); }
    catch { return json(res, 400, { error: "Invalid URL" }); }
    if ((url.pathname === "/api" || url.pathname.startsWith("/api/"))) return json(res, 403, { error: "Agent controls are local only" });
    const cookie = (req.headers.cookie || "")
      .split(";")
      .map((value) => value.trim());
    const authenticated = cookie.includes(`bb-tunnel-auth=${secret}`);
    if (url.searchParams.get("bb_token") === secret) {
      url.searchParams.delete("bb_token");
      const location = `${url.pathname}${url.searchParams.size ? `?${url.searchParams}` : ""}`;
      res.writeHead(302, {
        "Set-Cookie": `bb-tunnel-auth=${secret}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`,
        Location: location || "/",
        "Cache-Control": "no-store",
      });
      return res.end();
    }
    if (!authenticated) {
      res.writeHead(401, {
        "Content-Type": "text/plain",
        "Cache-Control": "no-store",
      });
      return res.end("Unauthorized tunnel request\n");
    }
    const headers = { ...req.headers, host: `127.0.0.1:${port}`, "x-demo-tunnel": secret };
    delete headers["x-demo-control-token"];
    delete headers.cookie;
    const hopHeaders = ["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade", ...(req.headers.connection || "").split(",").map(name => name.trim().toLowerCase())];
    for (const name of hopHeaders) delete headers[name];
    headers.host = `127.0.0.1:${port}`;
    headers["x-demo-tunnel"] = secret;
    const upstream = http.request(
      { host: "127.0.0.1", port, method: req.method, path: req.url, headers },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      },
    );
    upstream.on("error", (error) => {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end(`Local demo unavailable: ${error.message}\n`);
    });
    req.pipe(upstream);
  });
}

async function ensureTunnel() {
  if (tunnel?.url && tunnel.process?.exitCode == null) return tunnel;
  if (tunnelStarting) return tunnelStarting;
  tunnelStarting = new Promise(async (resolve, reject) => {
    const secret = randomUUID();
    const proxy = createTunnelProxy(secret);
    await new Promise((done, fail) => {
      proxy.listen(0, "127.0.0.1", done);
      proxy.once("error", fail);
    });
    const proxyPort = proxy.address().port;
    const child = spawn(
      "cloudflared",
      ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${proxyPort}`],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let output = "",
      settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.kill("SIGINT");
      proxy.close();
      reject(error);
    };
    const onData = (chunk) => {
      output = (output + chunk.toString()).slice(-20_000);
      const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) {
        tunnel = { url: match[0], secret, proxy, process: child };
        finish(tunnel);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("error", fail);
    child.once("exit", (code) => {
      if (!settled)
        fail(
          new Error(`cloudflared exited before creating a tunnel (${code})`),
        );
    });
    const timeout = setTimeout(
      () => fail(new Error("Timed out creating the localhost tunnel")),
      30_000,
    );
  }).finally(() => {
    tunnelStarting = null;
  });
  return tunnelStarting;
}

const PUBLIC_MARKET_DATA_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=MCOILWTICO";

const agentTask = `Prepare the live indexed energy-surcharge update using these run-specific inputs:
- Public market-data CSV: %source_url%
- SAP Purchase Contracts portal: %target_url%
- Contract: PC-2026-03782, Commodity B
- Item: 99999, PISTON
- Price condition: 9977, Energy surcharge
- Current condition price: 0.415 USD per 1 EA
- LTA market-index pass-through: 50% (0.5)
- Baseline Total Price: 87.515 USD per 1 EA
- Effective date: 07-01-2026
- Valid to: 12-31-2026
- Price Change Reason: 8985, Energy premium`;

async function startAgentRun() {
  const activeTunnel = await ensureTunnel();
  const targetUrl = `${activeTunnel.url}/?bb_token=${encodeURIComponent(activeTunnel.secret)}`;
  let agentId = process.env.BROWSERBASE_AGENT_ID;
  if (!agentId) {
    try {
      agentId = JSON.parse(fs.readFileSync(agentConfigPath, "utf8")).agentId;
    } catch {}
  }
  if (!agentId)
    throw new Error(
      "Reusable SAP Agent is not configured. Run: npm run agent:setup",
    );
  const run = await bbFetch("/v1/agents/runs", {
    method: "POST",
    body: JSON.stringify({
      agentId,
      task: agentTask
        .replace("%source_url%", PUBLIC_MARKET_DATA_URL)
        .replace("%target_url%", targetUrl),
    }),
  });
  return run;
}

function sanitizeForClient(value) {
  let serialized = JSON.stringify(value);
  if (tunnel?.secret)
    serialized = serialized.replaceAll(tunnel.secret, "[redacted]");
  serialized = serialized.replace(
    /bb_token=[^&"'\\\s]+/g,
    "bb_token=[redacted]",
  );
  return JSON.parse(serialized);
}

async function handleApi(req, res, url) {
  try {
    if (req.method === "GET" && url.pathname === "/api/agent/config") {
      let reusableAgent = false;
      try {
        reusableAgent = Boolean(
          process.env.BROWSERBASE_AGENT_ID ||
          JSON.parse(fs.readFileSync(agentConfigPath, "utf8")).agentId,
        );
      } catch {}
      return json(res, 200, {
        configured: Boolean(process.env.BROWSERBASE_API_KEY),
        reusableAgent,
        tunnel: Boolean(tunnel?.url),
      });
    }
    if (req.method === "POST" && url.pathname === "/api/agent/start") {
      await readJson(req);
      const run = await startAgentRun();
      return json(res, 201, sanitizeForClient(run));
    }
    const runMatch = url.pathname.match(/^\/api\/agent\/runs\/([^/]+)$/);
    if (req.method === "GET" && runMatch) {
      const run = await bbFetch(
        `/v1/agents/runs/${encodeURIComponent(runMatch[1])}`,
      );
      return json(
        res,
        200,
        sanitizeForClient({
          ...run,
          sessionUrl: run.sessionId
            ? `https://www.browserbase.com/sessions/${run.sessionId}`
            : null,
        }),
      );
    }
    const messageMatch = url.pathname.match(
      /^\/api\/agent\/runs\/([^/]+)\/messages$/,
    );
    if (req.method === "GET" && messageMatch) {
      const since = url.searchParams.get("since");
      const suffix = since ? `?since=${encodeURIComponent(since)}` : "";
      const messages = await bbFetch(
        `/v1/agents/runs/${encodeURIComponent(messageMatch[1])}/messages${suffix}`,
      );
      return json(res, 200, sanitizeForClient(messages));
    }
    return json(res, 404, { error: "API endpoint not found" });
  } catch (error) {
    console.error("[agent-api]", error.message);
    return json(res, 500, { error: error.message });
  }
}

const server = http.createServer(async (req, res) => {
  if (!localHosts.has(req.headers.host)) return json(res, 403, { error: "Invalid host" });
  let url;
  try { url = new URL(req.url, `http://${req.headers.host}`); }
  catch { return json(res, 400, { error: "Invalid URL" }); }
  const viaTunnel = Boolean(req.headers["x-demo-tunnel"]);
  if ((url.pathname === "/api" || url.pathname.startsWith("/api/"))) {
    const origin = req.headers.origin;
    if (viaTunnel || req.headers["x-demo-control-token"] !== controlToken
      || (origin && ![...localHosts].some(host => origin === `http://${host}`))) {
      return json(res, 403, { error: "Agent controls require the local demo page" });
    }
    return handleApi(req, res, url);
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end();
  }
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  if (!publicAssets.has(requested)) return json(res, 404, { error: "Not found" });
  const file = path.join(root, requested);
  try {
    const canonicalRoot = fs.realpathSync(root);
    if (fs.realpathSync(file) !== path.join(canonicalRoot, requested)) {
      return json(res, 404, { error: "Not found" });
    }
    const descriptor = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    let data;
    try {
      if (!fs.fstatSync(descriptor).isFile()) return json(res, 404, { error: "Not found" });
      data = fs.readFileSync(descriptor);
    } finally { fs.closeSync(descriptor); }
    if (requested === "/index.html") {
      data = Buffer.from(data.toString("utf8").replace("__DEMO_CONTROL_TOKEN__", viaTunnel ? "" : controlToken));
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)],
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "frame-ancestors 'none'",
    });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    return json(res, 404, { error: "Not found" });
  }
});

server.listen(port, "127.0.0.1", () =>
  console.log(`Procurement demo running at http://127.0.0.1:${port}`),
);

function shutdown() {
  if (tunnel?.process?.exitCode == null) tunnel.process.kill("SIGINT");
  tunnel?.proxy?.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
