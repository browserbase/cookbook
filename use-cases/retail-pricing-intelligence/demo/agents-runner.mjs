// Reusable Browserbase managed-Agents fan-out + poll harness.
// Creates one agent run per task (async), polls all to terminal, writes structured
// results + session replay links to <outDir>/results.json. Reused across RQ phases.
import Browserbase from "@browserbasehq/sdk";
import fs from "fs";
import path from "path";

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

const OUT_DIR = process.argv[2] || "./rq1";
const TASKS_FILE = process.argv[3] || "./rq1/tasks.json";
const MAX_WAIT_MS = 25 * 60 * 1000; // 25 min cap
const POLL_MS = 20 * 1000;
const TERMINAL = new Set(["COMPLETED", "FAILED", "STOPPED", "TIMED_OUT"]);

const { tasks, resultSchema } = JSON.parse(fs.readFileSync(TASKS_FILE, "utf8"));
fs.mkdirSync(OUT_DIR, { recursive: true });

const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);

const runs = [];
for (const t of tasks) {
  try {
    const r = await bb.agents.runs.create({
      task: t.task,
      resultSchema,
      browserSettings: {
        proxies: true,
        ...(t.contextId
          ? { context: { id: t.contextId, persist: false } }
          : {}),
      },
    });
    runs.push({
      label: t.label,
      runId: r.runId,
      sessionId: r.sessionId,
      status: r.status,
    });
    log(`created ${t.label}: run ${r.runId} (${r.status})`);
  } catch (e) {
    runs.push({ label: t.label, error: String(e.message || e) });
    log(`FAILED to create ${t.label}: ${e.message || e}`);
  }
}

const start = Date.now();
const done = new Map();
while (Date.now() - start < MAX_WAIT_MS) {
  const pending = runs.filter((r) => r.runId && !done.has(r.runId));
  if (!pending.length) break;
  await new Promise((res) => setTimeout(res, POLL_MS));
  for (const r of pending) {
    try {
      const cur = await bb.agents.runs.retrieve(r.runId);
      if (TERMINAL.has(cur.status)) {
        done.set(r.runId, {
          label: r.label,
          runId: r.runId,
          sessionId: cur.sessionId || r.sessionId,
          status: cur.status,
          result: cur.result || null,
          replayUrl: `https://www.browserbase.com/sessions/${cur.sessionId || r.sessionId}`,
        });
        log(`${r.label} → ${cur.status}`);
      } else {
        log(`${r.label} … ${cur.status}`);
      }
    } catch (e) {
      log(`poll error ${r.label}: ${e.message || e}`);
    }
  }
}

const results = runs.map(
  (r) =>
    done.get(r.runId) || {
      ...r,
      status: r.status || "TIMEOUT_UNRESOLVED",
      replayUrl: r.sessionId
        ? `https://www.browserbase.com/sessions/${r.sessionId}`
        : null,
    },
);
const outPath = path.join(OUT_DIR, "results.json");
fs.writeFileSync(
  outPath,
  JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2),
);
log(
  `wrote ${outPath} — ${results.filter((r) => r.status === "COMPLETED").length}/${results.length} completed`,
);
