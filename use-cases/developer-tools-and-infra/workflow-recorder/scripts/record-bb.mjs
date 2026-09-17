#!/usr/bin/env node
// record-bb.mjs — one-shot Browserbase session recorder.
//
// One CDP WebSocket connection handles everything: inject the recorder, navigate
// to the start URL, stream Runtime events to runs/<id>/raw.ndjson, then close
// cleanly on Ctrl-C and run the transform.
//
// No dependency on `browse` — we talk to BB's CDP endpoint directly via `ws`.
// `bb` is still used for `sessions create` and `sessions debug`.

import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { recorderEvents } from "./secret-inputs.mjs";

import { makeCdpClient, attachToPage } from "./cdp.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── flag parsing ──────────────────────────────────────────────────

function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-open") {
      out.noOpen = true;
      continue;
    }
    if (a === "--proxy") {
      out.proxy = true;
      continue;
    }
    if (a === "--verified") {
      out.verified = true;
      continue;
    }
    if (a === "--solve-captchas") {
      out.solveCaptchas = true;
      continue;
    }
    if (a.startsWith("--")) {
      const key = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      out[key] = argv[++i];
    } else {
      throw new Error(`Unexpected positional arg: ${a}`);
    }
  }
  return out;
}

const flags = parseFlags(process.argv.slice(2));

if (!process.env.BROWSERBASE_API_KEY) {
  console.error("BROWSERBASE_API_KEY must be set");
  process.exit(1);
}

const runId = flags.runId || isoStampShort();
const runsRoot = path.resolve(process.cwd(), "runs");
const runDir = path.join(runsRoot, runId);
fs.mkdirSync(runDir, { recursive: true });

// ── 1. Create BB session ───────────────────────────────────────────

const bbArgs = ["sessions", "create", "--keep-alive"];
if (flags.timeout) bbArgs.push("--timeout", String(flags.timeout));
else bbArgs.push("--timeout", "1800");
if (flags.region) bbArgs.push("--region", flags.region);
if (flags.context) bbArgs.push("--context-id", flags.context, "--persist");
if (flags.proxy) bbArgs.push("--proxies");
if (flags.verified) bbArgs.push("--verified");
if (flags.solveCaptchas) bbArgs.push("--solve-captchas");
if (flags.viewport) bbArgs.push("--viewport", flags.viewport);

console.log(`→ bb ${bbArgs.join(" ")}`);
const createOut = execFileSync("bb", bbArgs, { encoding: "utf8" });
const session = JSON.parse(createOut);
console.log(
  `✓ session ${session.id} created (region=${session.region}, expires=${session.expiresAt})`,
);

const sessionId = session.id;
const connectUrl = session.connectUrl;
let stopping = false;
let releaseAttempted = false;
let client;
let rawFd;
// Register cleanup before any CDP initialization can fail.
process.once("exit", () => {
  client?.close();
  if (rawFd !== undefined) { try { fs.closeSync(rawFd); } catch {} }
  releaseSession();
});

// ── 2. Fetch debugger URL ─────────────────────────────────────────

const debugOut = execFileSync("bb", ["sessions", "debug", sessionId], {
  encoding: "utf8",
});
const debug = JSON.parse(debugOut);
const debuggerUrl = debug.debuggerFullscreenUrl || debug.debuggerUrl;
console.log(`✓ live debugger: ${debuggerUrl}`);

// ── 3. Open CDP connection ────────────────────────────────────────

console.log(`→ opening CDP connection`);
client = makeCdpClient(connectUrl);
await client.opened;
const {
  targetId,
  sessionId: cdpSessionId,
  initialUrl,
} = await attachToPage(client);
console.log(
  `✓ attached to page target (target=${targetId.slice(0, 12)}…, url=${initialUrl})`,
);

// ── 4. Register recorder + enable Runtime for console events ──────

const recorderSource = fs.readFileSync(
  path.join(__dirname, "recorder.js"),
  "utf8",
);

await client.send("Page.enable", {}, cdpSessionId);
const reg = await client.send(
  "Page.addScriptToEvaluateOnNewDocument",
  { source: recorderSource },
  cdpSessionId,
);
await client.send(
  "Runtime.evaluate",
  { expression: recorderSource, awaitPromise: false },
  cdpSessionId,
);
await client.send("Runtime.enable", {}, cdpSessionId);
console.log(`✓ recorder registered (script id=${reg.identifier})`);

// ── 5. Wire the firehose: every CDP event → raw.ndjson ───────────

const rawNdjsonPath = path.join(runDir, "raw.ndjson");
rawFd = fs.openSync(rawNdjsonPath, "w");
let eventsWritten = 0;

client.onRaw((msg) => {
  try {
    for (const event of recorderEvents(msg)) {
      fs.writeSync(rawFd, JSON.stringify(event) + "\n");
      eventsWritten++;
    }
  } catch {
    console.error("Discarded an unsafe recorder event; re-record this sensitive step.");
  }
});

// ── 6. Navigate to start URL (if requested) — via CDP, not browse ─

if (flags.startUrl) {
  console.log(`→ navigating to ${flags.startUrl}`);
  try {
    await client.send("Page.navigate", { url: flags.startUrl }, cdpSessionId);
  } catch (err) {
    console.error(`⚠ start-url navigation failed: ${err.message}`);
  }
}

// ── 7. Auto-open debugger URL ─────────────────────────────────────

if (!flags.noOpen) {
  const opener =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  const r = spawnSync(opener, [debuggerUrl], { stdio: "ignore" });
  if (r.status === 0) console.log(`✓ opened live view in default browser`);
  else
    console.log(
      `⚠ couldn't auto-open browser — paste this URL: ${debuggerUrl}`,
    );
} else {
  console.log(`Live view: ${debuggerUrl}`);
}

// ── 8. Write recording config ─────────────────────────────────────

const recordingConfig = {
  run_id: runId,
  started_at: new Date().toISOString(),
  browserbase: {
    session_id: sessionId,
    project_id: session.projectId,
    region: session.region,
    debugger_url: debuggerUrl,
    connect_url_prefix: (connectUrl || "").slice(0, 60),
  },
  config: {
    start_url: flags.startUrl || null,
    timeout: Number(flags.timeout || 1800),
    viewport: flags.viewport || null,
    region: flags.region || null,
    context_id: flags.context || null,
    proxy: Boolean(flags.proxy),
    verified: Boolean(flags.verified),
    solve_captchas: Boolean(flags.solveCaptchas),
  },
  injection: {
    target_id: targetId,
    session_id: cdpSessionId,
    identifier: reg.identifier,
  },
};
fs.writeFileSync(
  path.join(runDir, "recording-config.json"),
  JSON.stringify(recordingConfig, null, 2) + "\n",
);

// ── 9. Wait for Ctrl-C ────────────────────────────────────────────

console.log(
  `\n  Recording. Drive the workflow in your browser, then Ctrl-C here when done.\n`,
);
console.log(`  Run dir: ${runDir}`);

function releaseSession() {
  if (releaseAttempted) return;
  releaseAttempted = true;
  // Best-effort, idempotent. Always print whether it succeeded so the user
  // knows what they're paying for.
  try {
    const r = spawnSync(
      "bb",
      ["sessions", "update", sessionId, "--status", "REQUEST_RELEASE"],
      { encoding: "utf8", timeout: 30_000 },
    );
    if (r.status === 0)
      console.log(`✓ session ${sessionId.slice(0, 8)}… released`);
    else
      console.error(
        `⚠ session release returned non-zero: ${r.stderr || r.stdout}`,
      );
  } catch (err) {
    console.error(`⚠ session release threw: ${err.message}`);
  }
}

await new Promise((resolve) => {
  const stop = (reason = "user-stopped") => {
    if (stopping) return;
    stopping = true;
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    if (reason !== "user-stopped") {
      process.exitCode = 1;
      console.error(`Capture interrupted: ${reason}`);
    }
    console.log(`\n→ stopping capture (${eventsWritten} CDP events captured)…`);
    client.close();
    setTimeout(() => {
      try {
        fs.closeSync(rawFd);
      } catch {}

      const m = JSON.parse(
        fs.readFileSync(path.join(runDir, "recording-config.json"), "utf8"),
      );
      m.capture_status = reason === "user-stopped" ? "stopped" : "interrupted";
      m.stop_reason = reason;
      m.stopped_at = new Date().toISOString();
      m.events_captured = eventsWritten;
      fs.writeFileSync(
        path.join(runDir, "recording-config.json"),
        JSON.stringify(m, null, 2) + "\n",
      );

      const bytes = fs.statSync(rawNdjsonPath).size;
      console.log(
        `✓ capture stopped — ${(bytes / 1024).toFixed(1)} KB in raw.ndjson`,
      );

      console.log(`→ releasing Browserbase session`);
      releaseSession();

      console.log(`→ transforming → trace.json`);
      const tr = spawnSync(
        process.execPath,
        [path.join(__dirname, "transform-recording.mjs"), runId],
        { stdio: "inherit" },
      );
      if (tr.status !== 0) {
        console.error(
          `⚠ transform failed — you can re-run manually: cookbook_example export ${runId}`,
        );
      }

      console.log(`\n  Done. Next: cookbook_example export ${runId}`);
      resolve();
    }, 300);
  };
  const onSignal = () => stop("user-stopped");
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  client.closed.then(({ reason }) => stop(reason));
});

// ── helpers ───────────────────────────────────────────────────────

function isoStampShort() {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+/, "")
    .replace("T", "-")
    .replace("Z", "");
}
