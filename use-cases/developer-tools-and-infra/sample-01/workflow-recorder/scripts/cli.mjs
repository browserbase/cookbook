#!/usr/bin/env node
// cli.mjs — single entry point for the sample_org CLI.
//
//   node scripts/cli.mjs record [--flags...]    → start a recording session
//   node scripts/cli.mjs export [<run-id>]      → run transform → detect → emit
//   node scripts/cli.mjs list                   → list recorded runs

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [sub, ...rest] = process.argv.slice(2);

function usage(code = 0) {
  const u = `
Usage:
  node scripts/cli.mjs record [--start-url <url>] [--context <id>] [--verified] ...
  node scripts/cli.mjs export [<run-id>] [--no-llm]
  node scripts/cli.mjs list
  node scripts/cli.mjs help
`;
  console.log(u.trim());
  process.exit(code);
}

if (!sub || sub === "help" || sub === "-h" || sub === "--help") usage();

const runsRoot = path.resolve(process.cwd(), "runs");

if (sub === "list") {
  if (!fs.existsSync(runsRoot)) {
    console.log("(no runs yet)");
    process.exit(0);
  }
  const ids = fs
    .readdirSync(runsRoot)
    .filter((d) => fs.statSync(path.join(runsRoot, d)).isDirectory())
    .sort();
  if (!ids.length) {
    console.log("(no runs yet)");
    process.exit(0);
  }
  for (const id of ids) {
    const dir = path.join(runsRoot, id);
    const has = (name) => fs.existsSync(path.join(dir, name));
    const flag = (name, ok) => `${ok ? "✓" : "·"}${name}`;
    console.log(
      `  ${id}  ${flag("config", has("recording-config.json"))} ${flag("trace", has("trace.json"))} ${flag("params", has("parameters.manifest.json"))} ${flag("script", has("stagehand/run.ts"))}`,
    );
  }
  process.exit(0);
}

if (sub === "record") {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "record-bb.mjs"), ...rest],
    { stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
}

if (sub === "export") {
  // Resolve run id: explicit arg, or latest in runs/.
  let runId = rest[0] && !rest[0].startsWith("--") ? rest.shift() : null;
  if (!runId) {
    if (!fs.existsSync(runsRoot)) {
      console.error("✗ no runs/ directory — record a session first");
      process.exit(1);
    }
    const ids = fs
      .readdirSync(runsRoot)
      .filter((d) => fs.statSync(path.join(runsRoot, d)).isDirectory())
      .sort();
    if (!ids.length) {
      console.error("✗ no runs found");
      process.exit(1);
    }
    runId = ids[ids.length - 1];
    console.log(`→ using latest run: ${runId}`);
  }

  const extra = rest;
  const steps = [
    ["transform-recording.mjs", [runId]],
    ["detect-parameters.mjs", [runId, ...extra]],
    ["emit-script.mjs", [runId]],
  ];
  for (const [script, scriptArgs] of steps) {
    console.log(`\n── ${script} ─────────────────────────────`);
    const r = spawnSync(
      process.execPath,
      [path.join(__dirname, script), ...scriptArgs],
      { stdio: "inherit" },
    );
    if (r.status !== 0) {
      console.error(`\n✗ ${script} failed`);
      process.exit(r.status ?? 1);
    }
  }
  console.log(
    `\n  Done. Review runs/${runId}/parameters.manifest.json — re-run export after edits.`,
  );
  process.exit(0);
}

usage(1);
