import { checkAccess, validSites } from "./access.js";
import { randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { mkdirSync, existsSync, writeFileSync, readdirSync, readFileSync, openSync, closeSync, fstatSync, constants } from "node:fs";
import { join, basename } from "node:path";
import { runBenchmark } from "./runner.js";
import { generateReportHtml } from "./report.js";
import { discoverScenarios, discoverCompetitors } from "./discover.js";
import type { RunResult } from "./types.js";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
type RunState = "idle" | "running" | "done" | "error";

let activeRunId: string | null = null;
let runState: RunState = "idle";
let runStartedAt: string | null = null;
let errorMessage: string | null = null;

// ---------------------------------------------------------------------------
// Run metadata
// ---------------------------------------------------------------------------
interface RunMeta {
  filename: string;
  startedAt: string;
  sites: string[];
  competitorCounts: Record<string, number>;
  errorCount: number;
}

function resultsDir(): string {
  const dir = join(process.cwd(), "results");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function loadRunMeta(): RunMeta[] {
  const dir = resultsDir();
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort().reverse();
  } catch {
    return [];
  }
  return files.flatMap((f) => {
    try {
      const data = JSON.parse(readFileSync(join(dir, f), "utf-8")) as RunResult[];
      const filename = basename(f, ".json");
      // Filename format: "2026-03-12T02-21" — convert to ISO
      const startedAt = filename.split("--")[0].replace(/T(\d{2})-(\d{2})(?:-(\d{2}))?$/, (_match, h, m, sec) => `T${h}:${m}:${sec ?? "00"}.000Z`);
      // Support both old format (runner) and new format (competitor)
      const getCompetitor = (r: RunResult) =>
        (r.competitor ?? (r as unknown as Record<string, unknown>).runner ?? "unknown") as string;
      const competitors = [...new Set(data.map(getCompetitor))];
      const competitorCounts = Object.fromEntries(
        competitors.map((c) => [
          c,
          data.filter((r) => getCompetitor(r) === c && !r.error).length,
        ]),
      );
      return [{
        filename,
        startedAt,
        sites: [...new Set(data.map((r) => r.site))],
        competitorCounts,
        errorCount: data.filter((r) => !!r.error).length,
      }];
    } catch {
      return [];
    }
  });
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      if (Buffer.byteLength(body) + Buffer.byteLength(chunk) > 16_384) {
        reject(new Error("Request body exceeds 16 KiB"));
        return;
      }
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
    req.on("aborted", () => reject(new Error("Request interrupted")));
  });
}

function jsonRes(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function htmlRes(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(body);
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------
class ReportInputError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function buildReportForFiles(filenames: string[]): string {
  const dir = resultsDir();
  if (filenames.length === 0) throw new ReportInputError(400, "Select at least one result file");
  const allResults: RunResult[] = filenames.flatMap((f) => {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(f)) {
      throw new ReportInputError(400, "Invalid result file ID");
    }
    const path = join(dir, f.endsWith(".json") ? f : `${f}.json`);
    let fd: number;
    try {
      fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") throw new ReportInputError(404, `Result file not found: ${f}`);
      if (code === "ELOOP") throw new ReportInputError(400, "Result files must not be symlinks");
      throw error;
    }
    try {
      if (!fstatSync(fd).isFile()) throw new ReportInputError(400, "Result ID must select a regular file");
      let data: unknown;
      try { data = JSON.parse(readFileSync(fd, "utf-8")); }
      catch { throw new ReportInputError(422, `Invalid result JSON: ${f}`); }
      if (!Array.isArray(data) || data.length === 0) {
        throw new ReportInputError(422, `No result data in file: ${f}`);
      }
      return data as RunResult[];
    } finally {
      closeSync(fd);
    }
  });

  const html = generateReportHtml(allResults);

  // Inject a "← Dashboard" nav bar at the top of the report
  const navBar = [
    `<div style="position:sticky;top:0;z-index:200;background:#0f172a;`,
    `border-bottom:1px solid #334155;padding:.55rem 1.5rem;`,
    `display:flex;align-items:center;gap:.85rem;font-size:.82rem">`,
    `<a href="/" style="color:#94a3b8;text-decoration:none;`,
    `display:flex;align-items:center;gap:.3rem">← Dashboard</a>`,
    `<span style="color:#334155">|</span>`,
    `<span style="color:#64748b">${filenames.join(", ")}</span>`,
    `</div>`,
  ].join("");

  return html.replace("<body>", `<body>${navBar}`);
}

// ---------------------------------------------------------------------------
// Dashboard HTML
// ---------------------------------------------------------------------------
function fmtRunDate(isoTimestamp: string): string {
  try {
    return new Date(isoTimestamp).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return isoTimestamp;
  }
}

function runRowHtml(r: RunMeta): string {
  const sites = r.sites.map((s) => { try { return new URL(s).hostname; } catch { return s; } }).join(", ");
  return `
  <div class="run-row">
    <input type="checkbox" class="run-cb" value="${r.filename}" onchange="updateAggBtn()"/>
    <div class="run-info">
      <strong>${fmtRunDate(r.startedAt)}</strong>
      <span>${sites}</span>
    </div>
    <div class="run-stats">
      ${Object.entries(r.competitorCounts).map(([c, n]) => `<span>${c}: ${n}</span>`).join("")}
      ${r.errorCount > 0 ? `<span class="err">${r.errorCount} err</span>` : ""}
    </div>
    <a href="/report?files=${encodeURIComponent(r.filename)}" target="_blank" class="btn">View Report →</a>
  </div>`;
}

function dashboardHtml(runs: RunMeta[], state: RunState): string {
  const stateLabels: Record<RunState, string> = {
    idle: "● Idle", running: "● Running…", done: "● Complete", error: "● Error",
  };
  const sitesDefault = process.env.BENCHMARK_SITES ?? "";
  const runsDefault = process.env.BENCHMARK_RUNS ?? "5";

  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Browserbase Benchmark</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
    header { background: #1e293b; padding: 1.25rem 2rem; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    header h1 { font-size: 1.3rem; font-weight: 700; color: #f1f5f9; }
    main { max-width: 860px; margin: 0 auto; padding: 2rem 1.5rem; display: flex; flex-direction: column; gap: 1.75rem; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: .75rem; padding: 1.5rem; }
    h2 { font-size: .95rem; font-weight: 600; color: #cbd5e1; margin-bottom: 1.25rem; text-transform: uppercase; letter-spacing: .04em; }
    label { color: #94a3b8; font-size: .85rem; display: block; margin-bottom: .35rem; }
    input[type=text], input[type=number] { width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: .4rem; color: #e2e8f0; font-size: .9rem; padding: .5rem .75rem; outline: none; transition: border-color .15s; }
    input[type=text]:focus, input[type=number]:focus { border-color: #6366f1; }
    input[type=number] { max-width: 90px; }
    .fields { display: flex; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .field { margin-bottom: 1rem; }
    .field:last-child { margin-bottom: 0; }
    input[type=checkbox] { accent-color: #6366f1; width: 14px; height: 14px; cursor: pointer; vertical-align: middle; }
    .check-label { display: flex; align-items: center; gap: .45rem; cursor: pointer; color: #94a3b8; font-size: .85rem; padding-top: 1.5rem; }
    .btn-primary { display: inline-flex; align-items: center; gap: .4rem; background: #4f46e5; border: none; border-radius: .5rem; color: #fff; font-size: .9rem; font-weight: 600; padding: .6rem 1.4rem; cursor: pointer; transition: background .15s; margin-top: 1.25rem; }
    .btn-primary:hover:not(:disabled) { background: #6366f1; }
    .btn-primary:disabled { opacity: .4; cursor: not-allowed; }
    .btn { display: inline-flex; align-items: center; background: #0f172a; border: 1px solid #334155; border-radius: .4rem; color: #94a3b8; font-size: .82rem; padding: .35rem .75rem; cursor: pointer; text-decoration: none; transition: all .15s; white-space: nowrap; }
    .btn:hover { border-color: #6366f1; color: #e2e8f0; }
    .btn-agg { background: #1e3a5f; border-color: #2563eb; color: #93c5fd; font-size: .85rem; font-weight: 600; padding: .4rem 1rem; }
    .btn-agg:hover:not(:disabled) { background: #1d4ed8; color: #fff; }
    .btn-agg:disabled { opacity: .35; cursor: not-allowed; }
    .badge { display: inline-flex; align-items: center; gap: .35rem; font-size: .8rem; font-weight: 600; padding: .25rem .65rem; border-radius: 999px; }
    .idle    { background: #1e293b; color: #64748b; border: 1px solid #334155; }
    .running { background: #1c2f4a; color: #38bdf8; border: 1px solid #0ea5e9; animation: pulse 2s infinite; }
    .done    { background: #14532d; color: #4ade80; border: 1px solid #16a34a; }
    .error   { background: #450a0a; color: #f87171; border: 1px solid #991b1b; }
    @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.55 } }
    .status-bar { display: flex; align-items: center; gap: .75rem; background: #0f172a; border-radius: .5rem; padding: .7rem 1rem; margin-top: 1rem; font-size: .85rem; color: #94a3b8; }
    .spinner { width: 14px; height: 14px; border: 2px solid #334155; border-top-color: #38bdf8; border-radius: 50%; animation: spin .7s linear infinite; flex-shrink: 0; }
    @keyframes spin { to { transform: rotate(360deg) } }
    .err-box { background: #450a0a; border: 1px solid #991b1b; border-radius: .5rem; padding: .7rem 1rem; color: #fca5a5; font-size: .85rem; margin-top: .75rem; }
    .run-row { display: flex; align-items: center; gap: .85rem; padding: .8rem 0; border-bottom: 1px solid #1e293b; flex-wrap: wrap; }
    .run-row:last-child { border-bottom: none; }
    .run-info { flex: 1; min-width: 150px; }
    .run-info strong { display: block; font-size: .88rem; color: #e2e8f0; }
    .run-info span { font-size: .78rem; color: #64748b; }
    .run-stats { display: flex; gap: .75rem; font-size: .78rem; color: #94a3b8; }
    .run-stats .err { color: #f87171; }
    .agg-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; gap: .75rem; flex-wrap: wrap; }
    .agg-hint { font-size: .8rem; color: #64748b; }
    .empty { color: #64748b; font-size: .9rem; text-align: center; padding: 2rem 0; }
  </style>
</head>
<body>
<header>
  <h1>Browserbase Benchmark</h1>
  <div id="status-badge" class="badge ${state}">${stateLabels[state]}</div>
</header>
<main>

  <!-- New Run -->
  <div class="card">
    <h2>New Run</h2>
    <form id="run-form">
      <div class="field">
        <label for="sites">Sites <span style="color:#475569">(comma-separated URLs)</span></label>
        <input id="sites" type="text" placeholder="https://example.com,https://other.com" value="${sitesDefault}"/>
      </div>
      <div class="fields">
        <div class="field">
          <label for="runs">Runs per site</label>
          <input id="runs" type="number" min="1" max="100" value="${runsDefault}"/>
        </div>
        <label class="check-label">
          <input type="checkbox" id="browser-only"/>
          Browser-only <span style="color:#475569">(skip LLM phases)</span>
        </label>
      </div>
      <button type="submit" id="start-btn" class="btn-primary" ${state === "running" ? "disabled" : ""}>▶ Start Benchmark</button>
    </form>
    <div id="run-status" class="status-bar" style="display:${state === "running" ? "flex" : "none"}">
      <div class="spinner"></div>
      <span>Benchmark running…</span>
    </div>
    <div id="err-box" class="err-box" style="display:none"></div>
  </div>

  <!-- Past Runs -->
  <div class="card">
    <div class="agg-bar">
      <h2 style="margin:0">Past Runs</h2>
      <div style="display:flex;align-items:center;gap:.75rem">
        <span class="agg-hint" id="agg-hint">Check runs to aggregate</span>
        <button class="btn btn-agg" id="agg-btn" disabled onclick="openAgg()">Generate Aggregate Report</button>
      </div>
    </div>
    ${runs.length === 0
      ? `<p class="empty">No runs yet — start one above.</p>`
      : `<div>${runs.map(runRowHtml).join("")}</div>`
    }
  </div>

</main>
<script>
let poll = null;
let prevState = "${state}"; // track transitions — only reload on running→done

const LABELS = { idle:"● Idle", running:"● Running…", done:"● Complete", error:"● Error" };

function setUI(state, err) {
  const badge = document.getElementById("status-badge");
  const status = document.getElementById("run-status");
  const btn = document.getElementById("start-btn");
  const errBox = document.getElementById("err-box");
  badge.textContent = LABELS[state] ?? "● Idle";
  badge.className = "badge " + state;
  status.style.display = state === "running" ? "flex" : "none";
  btn.disabled = state === "running";
  if (state === "error" && err) { errBox.textContent = err; errBox.style.display = "block"; }
  else errBox.style.display = "none";
}

async function checkStatus() {
  try {
    const d = await fetch("/status").then(r => r.json());
    setUI(d.state, d.error);
    if (d.state !== "running") {
      clearInterval(poll); poll = null;
      // Only reload when we witnessed the running→done transition, not on every page load
      if (d.state === "done" && prevState === "running") location.reload();
    }
    prevState = d.state;
  } catch {}
}

document.getElementById("run-form").addEventListener("submit", async e => {
  e.preventDefault();
  document.getElementById("err-box").style.display = "none";
  const body = {
    sites: document.getElementById("sites").value,
    runs: parseInt(document.getElementById("runs").value, 10),
    browserOnly: document.getElementById("browser-only").checked,
  };
  const res = await fetch("/run", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
  if (res.ok) {
    prevState = "running";
    setUI("running", null);
    poll = setInterval(checkStatus, 3000);
  } else {
    const e2 = await res.json().catch(() => ({}));
    const errBox = document.getElementById("err-box");
    errBox.textContent = e2.error ?? "Failed to start run";
    errBox.style.display = "block";
  }
});

function updateAggBtn() {
  const checked = document.querySelectorAll(".run-cb:checked");
  document.getElementById("agg-btn").disabled = checked.length === 0;
  document.getElementById("agg-hint").textContent =
    checked.length > 0 ? checked.length + " run" + (checked.length > 1 ? "s" : "") + " selected" : "Check runs to aggregate";
}

function openAgg() {
  const files = [...document.querySelectorAll(".run-cb:checked")].map(c => c.value);
  if (files.length) window.open("/report?files=" + encodeURIComponent(files.join(",")), "_blank");
}

// Init
checkStatus();
if ("${state}" === "running") poll = setInterval(checkStatus, 3000);
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------
async function handler(req: IncomingMessage, res: ServerResponse) {
  const rawUrl = req.url ?? "/";
  const [urlPath, qs] = rawUrl.split("?");
  const method = req.method ?? "GET";

  // GET /health
  if (urlPath === "/health" && method === "GET") {
    jsonRes(res, 200, { status: "ok" });
    return;
  }

  const denied = checkAccess(req, process.env);
  if (denied) {
    if (denied.status === 401) res.setHeader("WWW-Authenticate", 'Basic realm="Benchmark", charset="UTF-8"');
    jsonRes(res, denied.status, { error: denied.error });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Frame-Options", "DENY");

  // GET / — dashboard
  if (urlPath === "/" && method === "GET") {
    htmlRes(res, 200, dashboardHtml(loadRunMeta(), runState));
    return;
  }

  // GET /status — lightweight poll
  if (urlPath === "/status" && method === "GET") {
    jsonRes(res, 200, { state: runState, runId: activeRunId, startedAt: runStartedAt, error: errorMessage });
    return;
  }

  // GET /runs — list all result files
  if (urlPath === "/runs" && method === "GET") {
    jsonRes(res, 200, loadRunMeta());
    return;
  }

  // GET /report?files=f1,f2,...
  if (urlPath === "/report" && method === "GET") {
    const params = new URLSearchParams(qs ?? "");
    const filesParam = params.get("files");
    const dir = resultsDir();

    let filenames: string[];
    if (filesParam) {
      filenames = filesParam.split(",").map((f) => f.trim()).filter(Boolean);
    } else {
      // Fall back to latest file
      const all = readdirSync(dir).filter((f) => f.endsWith(".json")).sort().reverse();
      if (all.length === 0) { jsonRes(res, 404, { error: "No result files found" }); return; }
      filenames = [basename(all[0], ".json")];
    }

    try {
      htmlRes(res, 200, buildReportForFiles(filenames));
    } catch (err) {
      if (err instanceof ReportInputError) {
        jsonRes(res, err.status, { error: err.message });
        return;
      }
      console.error("Report generation failed:", err);
      jsonRes(res, 500, { error: "Failed to generate report" });
    }
    return;
  }

  // POST /run — start benchmark
  if (urlPath === "/run" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      const raw = await readBody(req);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Expected a JSON object");
      }
      body = parsed as Record<string, unknown>;
      for (const key of ["sites", "competitors", "scenarios"]) {
        if (body[key] !== undefined && typeof body[key] !== "string") throw new Error(`Invalid ${key}`);
      }
      for (const key of ["localOnly", "browserOnly"]) {
        if (body[key] !== undefined && typeof body[key] !== "boolean") throw new Error(`Invalid ${key}`);
      }
      if (body.runs !== undefined && typeof body.runs !== "number") throw new Error("Invalid runs");
    } catch {
      jsonRes(res, 400, { error: "Expected a JSON object with string sites/filters, numeric runs and boolean mode flags" });
      return;
    }

    const sites = typeof body.sites === "string"
      ? body.sites.split(",").map((s) => s.trim()).filter(Boolean)
      : (process.env.BENCHMARK_SITES ?? "").split(",").map((s) => s.trim()).filter(Boolean);

    const runs = typeof body.runs === "number"
      ? body.runs
      : Number(process.env.BENCHMARK_RUNS ?? "5");

    const localOnly = typeof body.localOnly === "boolean" ? body.localOnly : false;
    const browserOnly = typeof body.browserOnly === "boolean"
      ? body.browserOnly
      : process.env.BROWSER_ONLY === "true";
    const competitorFilter =
      localOnly ? ["local-chromium"] :
      typeof body.competitors === "string" ? body.competitors.split(",").map((s: string) => s.trim()).filter(Boolean) :
      undefined;
    const scenarioFilter =
      typeof body.scenarios === "string" ? body.scenarios.split(",").map((s: string) => s.trim()).filter(Boolean) :
      undefined;

    if (sites.length === 0) {
      jsonRes(res, 400, { error: "No sites configured. Set BENCHMARK_SITES or pass sites in the request body." });
      return;
    }

    if (!validSites(sites)) {
      jsonRes(res, 400, { error: "Supply 1 to 10 distinct HTTP(S) site URLs without credentials" });
      return;
    }
    if (!Number.isSafeInteger(runs) || runs < 1 || runs > 100) {
      jsonRes(res, 400, { error: "Runs must be an integer between 1 and 100" });
      return;
    }
    if (runState === "running") {
      jsonRes(res, 409, { error: "Benchmark already running" });
      return;
    }
    runState = "running";
    runStartedAt = new Date().toISOString();
    errorMessage = null;
    const runId = `${runStartedAt.replace(/:/g, "-").replace(/\.\d+Z$/, "")}--${randomUUID()}`;
    activeRunId = runId;

    jsonRes(res, 202, { status: "started", runId, sites, runs, browserOnly });

    Promise.all([discoverScenarios(scenarioFilter), discoverCompetitors(competitorFilter)])
      .then(([scenarios, competitors]) =>
        runBenchmark({ scenarios, competitors, sites, runs, browserOnly, host: "render" })
      )
      .then((results) => {
        const dir = resultsDir();
        writeFileSync(join(dir, `${runId}.json`), JSON.stringify(results, null, 2));
        runState = "done";
        console.log(`Benchmark complete — results saved to ${runId}.json`);
      })
      .catch((err: unknown) => {
        runState = "error";
        errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Benchmark failed:", errorMessage);
      });

    return;
  }

  // Results are selected by accepted run ID, never by the latest file.
  if (urlPath === "/results" && method === "GET") {
    const runId = new URLSearchParams(qs ?? "").get("runId");
    if (!runId || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(runId)) {
      jsonRes(res, 400, { error: "Supply the runId returned by POST /run" }); return;
    }
    if (runId === activeRunId && runState === "running") {
      jsonRes(res, 202, { status: "running", runId }); return;
    }
    if (runId === activeRunId && runState === "error") {
      jsonRes(res, 500, { error: errorMessage, runId }); return;
    }
    let fd: number | undefined;
    try {
      fd = openSync(join(resultsDir(), `${runId}.json`), constants.O_RDONLY | constants.O_NOFOLLOW);
      if (!fstatSync(fd).isFile()) { jsonRes(res, 400, { error: "Invalid result file" }); return; }
      jsonRes(res, 200, JSON.parse(readFileSync(fd, "utf-8")));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") jsonRes(res, 404, { error: "Unknown run ID" });
      else if (code === "ELOOP") jsonRes(res, 400, { error: "Invalid result file" });
      else jsonRes(res, 500, { error: "Unable to read run results" });
    } finally { if (fd !== undefined) closeSync(fd); }
    return;
  }

  jsonRes(res, 404, { error: `Unknown route: ${method} ${urlPath}` });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT ?? "3000", 10);

const server = createServer((req, res) => {
  handler(req, res).catch((err: unknown) => {
    console.error("Unhandled error:", err);
    if (!res.headersSent) jsonRes(res, 500, { error: "Internal server error" });
  });
});

server.listen(PORT, () => {
  console.log(`Benchmark server listening on port ${PORT}`);
  console.log(`  GET  /          — dashboard`);
  console.log(`  POST /run       — start benchmark`);
  console.log(`  GET  /status    — poll run state`);
  console.log(`  GET  /runs      — list all result files`);
  console.log(`  GET  /report    — view/generate report (optional ?files=f1,f2)`);
  console.log(`  GET  /health    — healthcheck`);
});
