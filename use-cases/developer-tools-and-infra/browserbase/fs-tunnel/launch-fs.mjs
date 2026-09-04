#!/usr/bin/env node
/**
 * browserbase-fs-tunnel launcher (prototype)
 *
 * Exposes a LOCAL DIRECTORY (read-only) to a Browserbase cloud session via an
 * auth-gated cloudflared quick tunnel. Same security model as
 * browserbase-localhost (skills PR #109), but the upstream is the local
 * filesystem instead of a dev-server port.
 *
 * Usage:
 *   node launch-fs.mjs --dir /path/to/share
 *
 * Required env: BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID
 *
 * Output: single JSON line then "---READY---", stays alive until SIGINT.
 */

import http from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { stat, realpath, open } from "node:fs/promises";
import path from "node:path";

// ─── Args ────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { dir: null, env: "prod" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dir") out.dir = argv[++i];
    else if (a === "--env") out.env = argv[++i];
    else if (a === "--help" || a === "-h") {
      console.error("Usage: launch-fs.mjs --dir <path> [--env prod|dev]");
      process.exit(0);
    }
  }
  return out;
}

const { dir, env } = parseArgs(process.argv);
if (!dir) {
  console.error("ERROR: --dir <path> is required");
  process.exit(2);
}
const ROOT = path.resolve(dir);
try {
  const s = await stat(ROOT);
  if (!s.isDirectory()) throw new Error("not a directory");
} catch (e) {
  console.error(`ERROR: --dir ${ROOT}: ${e.message}`);
  process.exit(2);
}

const BB_API_KEY = process.env.BROWSERBASE_API_KEY;
const BB_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID;
if (!BB_API_KEY || !BB_PROJECT_ID) {
  console.error(
    "ERROR: BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID must be set",
  );
  process.exit(2);
}

const BB_API_BASE =
  env === "dev"
    ? "https://api.dev.browserbase.com"
    : "https://api.browserbase.com";
const BB_DASH_BASE =
  env === "dev"
    ? "https://www.dev.browserbase.com"
    : "https://www.browserbase.com";

const SECRET = randomUUID();
const HEADER = "X-Tunnel-Auth";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".json": "application/json",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".csv": "text/csv",
  ".zip": "application/zip",
};

// ─── Auth-gated read-only static file server ────────────────────────────────
const server = http.createServer(async (req, res) => {
  if (req.headers[HEADER.toLowerCase()] !== SECRET) {
    res.writeHead(401, { "content-type": "text/plain" });
    res.end("unauthorized: missing or invalid tunnel auth header\n");
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "content-type": "text/plain" });
    res.end("read-only: GET/HEAD only\n");
    return;
  }

  // resolve + traversal guard: resolved path must stay inside ROOT
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname); }
  catch { res.writeHead(400); res.end("invalid path\n"); return; }
  let fsPath = path.resolve(ROOT, "." + path.posix.normalize("/" + urlPath));
  if (fsPath !== ROOT && !fsPath.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { "content-type": "text/plain" });
    res.end("forbidden\n");
    return;
  }

  let s;
  let realRoot;
  try {
    realRoot = await realpath(ROOT);
    fsPath = await realpath(fsPath);
    if (fsPath !== realRoot && !fsPath.startsWith(realRoot + path.sep)) {
      res.writeHead(403, { "content-type": "text/plain" });
      res.end("forbidden\n");
      return;
    }
    s = await stat(fsPath);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found\n");
    return;
  }

  if (s.isDirectory()) {
    res.writeHead(403, { "content-type": "text/plain" });
    res.end("directory listing is disabled; request an explicit file path\n");
    return;
  }

  let handle;
  try {
    handle = await open(fsPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const opened = await handle.stat();
    const finalPath = await realpath(fsPath);
    const finalStat = await stat(finalPath);
    if (
      (finalPath !== realRoot && !finalPath.startsWith(realRoot + path.sep)) ||
      !opened.isFile() ||
      opened.dev !== s.dev || opened.ino !== s.ino ||
      opened.dev !== finalStat.dev || opened.ino !== finalStat.ino
    ) {
      await handle.close();
      res.writeHead(403); res.end("file changed or unsupported type\n"); return;
    }
    const type = MIME[path.extname(fsPath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "content-type": type, "content-length": opened.size });
    if (req.method === "HEAD") {
      await handle.close(); res.end(); return;
    }
    const stream = handle.createReadStream();
    stream.on("error", () => res.destroy());
    res.on("close", () => stream.destroy());
    stream.pipe(res);
  } catch {
    if (handle) await handle.close().catch(() => {});
    if (!res.headersSent) { res.writeHead(403); res.end("file unavailable\n"); }
    else res.destroy();
  }

});

await new Promise((resolve, reject) => {
  server.listen(0, "127.0.0.1", resolve);
  server.on("error", reject);
});
const serverPort = server.address().port;
console.error(
  `[fs] auth-gated file server on 127.0.0.1:${serverPort} -> ${ROOT} (read-only)`,
);

// ─── cloudflared quick tunnel ────────────────────────────────────────────────
console.error(`[cloudflared] starting quick tunnel...`);
const cf = spawn(
  "cloudflared",
  ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${serverPort}`],
  { stdio: ["ignore", "pipe", "pipe"] },
);

const tunnelUrl = await new Promise((resolve, reject) => {
  let buf = "";
  const onChunk = (chunk) => {
    buf += chunk.toString();
    const m = buf.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m) {
      cf.stdout.off("data", onChunk);
      cf.stderr.off("data", onChunk);
      resolve(m[0]);
    }
  };
  cf.stdout.on("data", onChunk);
  cf.stderr.on("data", onChunk);
  cf.on("exit", (code) =>
    reject(new Error(`cloudflared exited (code ${code}) before URL was found`)),
  );
  setTimeout(
    () => reject(new Error("timed out waiting for cloudflared URL")),
    30_000,
  );
});
console.error(`[cloudflared] tunnel URL: ${tunnelUrl}`);

// ─── Create Browserbase session ──────────────────────────────────────────────
console.error(`[bb] creating session on ${BB_API_BASE}...`);
const bbRes = await fetch(`${BB_API_BASE}/v1/sessions`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-bb-api-key": BB_API_KEY },
  body: JSON.stringify({ projectId: BB_PROJECT_ID, keepAlive: true }),
});
if (!bbRes.ok) {
  const text = await bbRes.text();
  console.error(`[bb] failed to create session: ${bbRes.status} ${text}`);
  cf.kill("SIGINT");
  server.close();
  process.exit(1);
}
const session = await bbRes.json();
console.error(`[bb] session: ${session.id}`);

// ─── Emit connection JSON on stdout ─────────────────────────────────────────
const output = {
  tunnelUrl,
  secret: SECRET,
  headerName: HEADER,
  sessionId: session.id,
  connectUrl: session.connectUrl,
  dashboardUrl: `${BB_DASH_BASE}/sessions/${session.id}`,
  sharedDir: ROOT,
  serverPort,
};
process.stdout.write(JSON.stringify(output) + "\n");
process.stdout.write("---READY---\n");
// also persist config so attach.mjs can find it regardless of how we were run
const { writeFileSync } = await import("node:fs");
const { tmpdir } = await import("node:os");
writeFileSync(
  path.join(tmpdir(), "bb-fs-tunnel-last-run.json"),
  JSON.stringify(output) + "\n",
);

// ─── Cleanup on exit ─────────────────────────────────────────────────────────
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error(`\n[shutdown] received ${signal}, cleaning up...`);
  try {
    const response = await fetch(`${BB_API_BASE}/v1/sessions/${session.id}`, {
      method: "POST",
      signal: AbortSignal.timeout(5_000),
      headers: {
        "Content-Type": "application/json",
        "x-bb-api-key": BB_API_KEY,
      },
      body: JSON.stringify({
        status: "REQUEST_RELEASE",
        projectId: BB_PROJECT_ID,
      }),
    });
    if (!response.ok) {
      throw new Error(`release request failed with HTTP ${response.status}`);
    }
    console.error("[shutdown] BB session release requested");
  } catch (e) {
    console.error("[shutdown] release error:", e.message);
  } finally {
    cf.kill("SIGINT");
    server.close();
    setTimeout(() => process.exit(0), 500);
  }
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
cf.on("exit", (code) => {
  console.error(`[cloudflared] exited with code ${code}`);
  if (!shuttingDown) shutdown("cloudflared-exit");
});
