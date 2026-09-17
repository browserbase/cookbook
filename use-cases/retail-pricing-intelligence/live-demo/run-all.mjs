// Fires the whole RQ1 agent fleet in parallel, by agentId.
// Prints each session URL the moment it exists so you can open them in the
// Browserbase dashboard while they run. Writes results.json when everything lands.
//
//   node run-all.mjs              all agents
//   node run-all.mjs retailer marketplace_a   just those
import Browserbase from "@browserbasehq/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiKey = process.env.BROWSERBASE_API_KEY;
if (!apiKey) {
  console.error(
    "BROWSERBASE_API_KEY is not set.  Run:  set -a && . ./.env && set +a",
  );
  process.exit(1);
}
const bb = new Browserbase({ apiKey });

const POLL_MS = 15_000;
const MAX_WAIT_MS = 25 * 60 * 1000;
const TERMINAL = new Set(["COMPLETED", "FAILED", "STOPPED", "TIMED_OUT"]);

const manifestPath = path.join(__dirname, "agents.json");
if (!fs.existsSync(manifestPath)) {
  console.error("agents.json missing — run `npm run sync` first.");
  process.exit(1);
}
let { agents } = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
if (only.length) {
  agents = agents.filter((a) => only.includes(a.key));
  if (!agents.length) {
    console.error(`no agents matched: ${only.join(", ")}`);
    process.exit(1);
  }
}

const C = {
  dim: "\x1b[2m",
  red: "\x1b[31m",
  grn: "\x1b[32m",
  ylw: "\x1b[33m",
  cyn: "\x1b[36m",
  b: "\x1b[1m",
  r: "\x1b[0m",
};
const pad = (s, n) => String(s).padEnd(n);
const stamp = () => new Date().toTimeString().slice(0, 8);
const colorFor = (s) =>
  s === "COMPLETED" ? C.grn : TERMINAL.has(s) ? C.red : C.ylw;

console.log(
  `\n${C.b}RQ1 · Payment Discovery — launching ${agents.length} agents in parallel${C.r}\n`,
);

// --- launch (all at once) ---------------------------------------------
const runs = await Promise.all(
  agents.map(async (a) => {
    try {
      const r = await bb.agents.runs.create({
        agentId: a.agentId,
        task: a.task,
        browserSettings: { proxies: true },
      });
      console.log(
        `  ${C.grn}▶${C.r} ${pad(a.display, 20)} ${C.dim}run ${r.runId.slice(0, 8)}${C.r}`,
      );
      return {
        ...a,
        runId: r.runId,
        sessionId: r.sessionId,
        status: r.status || "RUNNING",
      };
    } catch (e) {
      console.log(
        `  ${C.red}✗${C.r} ${pad(a.display, 20)} ${C.red}launch failed: ${e?.message || e}${C.r}`,
      );
      return { ...a, error: String(e?.message || e), status: "LAUNCH_FAILED" };
    }
  }),
);

const live = runs.filter((r) => r.runId);
if (!live.length) {
  console.error("\nnothing launched.");
  process.exit(1);
}
// The create response has no sessionId yet — it appears a beat later. Poll fast up
// front purely to surface the dashboard links, since those are what you click on the call.
console.log(`\n${C.dim}resolving sessions…${C.r}\n`);
for (let i = 0; i < 20 && live.some((r) => !r.sessionId); i++) {
  await new Promise((r) => setTimeout(r, 2000));
  await Promise.all(
    live
      .filter((r) => !r.sessionId)
      .map(async (r) => {
        try {
          const cur = await bb.agents.runs.retrieve(r.runId);
          if (cur.sessionId) {
            r.sessionId = cur.sessionId;
            console.log(
              `  ${C.cyn}https://www.browserbase.com/sessions/${cur.sessionId}${C.r}  ${C.dim}${r.display}${C.r}`,
            );
          }
        } catch {
          /* not ready yet */
        }
      }),
  );
}
const missing = live.filter((r) => !r.sessionId);
if (missing.length)
  console.log(
    `  ${C.ylw}no session id yet for: ${missing.map((r) => r.display).join(", ")}${C.r}`,
  );

console.log(
  `\n${C.dim}polling every ${POLL_MS / 1000}s — Ctrl-C is safe, runs continue server-side${C.r}\n`,
);

// --- poll to terminal --------------------------------------------------
const done = new Map();
const start = Date.now();
while (done.size < live.length && Date.now() - start < MAX_WAIT_MS) {
  await new Promise((r) => setTimeout(r, POLL_MS));
  await Promise.all(
    live
      .filter((r) => !done.has(r.runId))
      .map(async (r) => {
        try {
          const cur = await bb.agents.runs.retrieve(r.runId);
          if (cur.sessionId) r.sessionId = cur.sessionId;
          if (TERMINAL.has(cur.status)) {
            done.set(r.runId, {
              ...r,
              status: cur.status,
              result: cur.result || null,
              error:
                cur.status === "COMPLETED"
                  ? null
                  : cur.cause?.message || cur.cause?.type || cur.status,
            });
            console.log(
              `  ${stamp()}  ${colorFor(cur.status)}${pad(cur.status, 10)}${C.r} ${r.display}`,
            );
          } else {
            console.log(
              `  ${stamp()}  ${C.dim}${pad(cur.status, 10)} ${r.display}${C.r}`,
            );
          }
        } catch (e) {
          console.log(
            `  ${stamp()}  ${C.red}poll error${C.r} ${r.display}: ${e?.message || e}`,
          );
        }
      }),
  );
}

// --- write results -----------------------------------------------------
const results = runs.map(
  (r) =>
    done.get(r.runId) || {
      ...r,
      status: r.runId ? "TIMEOUT_UNRESOLVED" : r.status,
    },
);
const out = path.join(__dirname, "results.json");
fs.writeFileSync(
  out,
  JSON.stringify(
    {
      phase: "RQ1 — Payment Discovery (pre-checkout)",
      generatedAt: new Date().toISOString(),
      results: results.map((r) => ({
        retailer: r.display,
        key: r.key,
        agentId: r.agentId,
        runId: r.runId ?? null,
        status: r.status,
        replayUrl: r.sessionId
          ? `https://www.browserbase.com/sessions/${r.sessionId}`
          : null,
        error: r.error ?? null,
        result: r.result ?? null,
      })),
    },
    null,
    2,
  ),
);

const ok = results.filter((r) => r.status === "COMPLETED").length;
console.log(`\n${C.b}${ok}/${results.length} completed${C.r} — wrote ${out}`);
for (const r of results.filter((x) => x.status !== "COMPLETED")) {
  console.log(
    `  ${C.red}${pad(r.display, 20)} ${r.status}${r.error ? ` — ${r.error}` : ""}${C.r}`,
  );
}
console.log();
