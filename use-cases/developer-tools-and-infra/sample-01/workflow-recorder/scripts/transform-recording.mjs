#!/usr/bin/env node
// transform-recording.mjs — turn the CDP firehose (raw.ndjson) into a clean
// trace.json of user operations.
//
// Each line of raw.ndjson is a CDP event; we filter for Runtime.consoleAPICalled
// entries whose first string arg starts with "[REC]" (emitted by recorder.js).
//
// Usage: node transform-recording.mjs <run-id> [--runs-root <dir>]

import fs from "node:fs";
import path from "node:path";
import { validateSecretOperations } from "./secret-inputs.mjs";

const args = process.argv.slice(2);
if (!args[0]) {
  console.error("usage: transform-recording.mjs <run-id> [--runs-root <dir>]");
  process.exit(2);
}
const runId = args[0];
const runsRoot = (() => {
  const i = args.indexOf("--runs-root");
  return i !== -1 ? args[i + 1] : path.resolve(process.cwd(), "runs");
})();
const runDir = path.join(runsRoot, runId);

if (!fs.existsSync(runDir)) {
  console.error(`run dir not found: ${runDir}`);
  process.exit(1);
}

// CDP firehose (Runtime domain only) is at <runDir>/raw.ndjson.
const logsPath = path.join(runDir, "raw.ndjson");
const tracePath = path.join(runDir, "trace.json");
if (!fs.existsSync(logsPath)) {
  if (fs.existsSync(tracePath)) {
    console.log(`✓ skipping transform — trace.json already exists`);
    process.exit(0);
  }
  console.error(`no raw.ndjson in ${runDir} — did the recording session run?`);
  process.exit(1);
}

// ── Pull every [REC] event ────────────────────────────────────────

const ops = [];
let recCount = 0,
  parseFailures = 0;

for (const line of fs.readFileSync(logsPath, "utf8").split("\n")) {
  if (!line) continue;
  let ev;
  try {
    ev = JSON.parse(line);
  } catch {
    continue;
  }
  if (ev.method !== "Runtime.consoleAPICalled") continue;

  // The recorder emits `console.log("[REC]" + JSON.stringify(payload))` so the
  // first arg is a single string. Some pages use string-interpolation in
  // console.log; defensive: scan all string args.
  const args = ev.params?.args || [];
  for (const arg of args) {
    if (arg.type !== "string" || typeof arg.value !== "string") continue;
    if (!arg.value.startsWith("[REC]")) continue;
    recCount++;
    try {
      const op = JSON.parse(arg.value.slice("[REC]".length));
      // Attach CDP-side timestamp so we have a wall-clock anchor even if the
      // recorder's ts drifted.
      op._cdp_ts = ev.params?.timestamp ?? null;
      op._cdp_exec_ctx = ev.params?.executionContextId ?? null;
      ops.push(op);
    } catch (e) {
      parseFailures++;
    }
  }
}

if (recCount === 0) {
  console.error(`✗ no [REC] events found in ${logsPath}.`);
  console.error(
    `  - Was the recorder injected? Check recording-config.json:injection.`,
  );
  console.error(`  - Did the user actually interact with the page?`);
  console.error(
    `  - Grep raw.ndjson for "consoleAPICalled" to see what events were captured.`,
  );
  process.exit(1);
}

// ── Stable ordering: prefer recorder's op_index (monotonic per page load) ─

ops.sort((a, b) => {
  // op_index resets per document. Use _cdp_ts as the primary key to keep
  // post-navigation ops after pre-navigation ones.
  if (a._cdp_ts != null && b._cdp_ts != null && a._cdp_ts !== b._cdp_ts) {
    return a._cdp_ts - b._cdp_ts;
  }
  return (a.op_index || 0) - (b.op_index || 0);
});

// ── Dedupe consecutive identical fill values on same element ──────

const dedup = [];
for (const op of ops) {
  const prev = dedup[dedup.length - 1];
  if (
    prev &&
    prev.op === op.op &&
    (op.op === "fill" || op.op === "select" || op.op === "check") &&
    JSON.stringify(prev.selectors || []) ===
      JSON.stringify(op.selectors || []) &&
    prev.value === op.value
  ) {
    continue;
  }
  dedup.push(op);
}

// ── Re-index sequentially and strip internal cdp metadata ─────────

const final = dedup.map((op, i) => {
  const { _cdp_ts, _cdp_exec_ctx, op_index, ...rest } = op;
  return { index: i, ...rest };
});

validateSecretOperations(final);

const trace = {
  schema_version: 1,
  run_id: runId,
  generated_at: new Date().toISOString(),
  stats: {
    rec_events_seen: recCount,
    parse_failures: parseFailures,
    ops_after_dedup: final.length,
  },
  ops: final,
};

fs.writeFileSync(tracePath, JSON.stringify(trace, null, 2) + "\n");

console.log(`✓ wrote ${tracePath}`);
console.log(
  `  ${final.length} ops (${recCount} [REC] events seen, ${recCount - final.length} deduped, ${parseFailures} parse failures)`,
);

// Quick summary by op type
const byOp = {};
for (const op of final) byOp[op.op] = (byOp[op.op] || 0) + 1;
console.log(
  `  breakdown: ${Object.entries(byOp)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ")}`,
);
