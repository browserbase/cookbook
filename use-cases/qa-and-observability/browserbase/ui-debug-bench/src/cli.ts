import { join } from "node:path";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import type { BugSpec, FeedbackLevel, InterfaceName, RunRecord, Target } from "./types.js";
import { loadSuite } from "./targets.js";
import { runBugEval, runHostedEval, type LoopOptions } from "./loop.js";
import { renderAggregateMarkdown } from "./reporting/aggregate.js";
import { loadDotEnv } from "./runtime/env.js";

loadDotEnv();

const HELP = `ui-debug-bench — evals for fixing web apps from browser evidence

Usage:
  npm run eval -- --target <dir> [options]

Options:
  --target <dir>         Target dir (has target.config.json) or suite dir of targets. Default: targets/starter
  --bug <id,id,...>      Only run these bug ids. Default: all bugs in the target(s)
  --mode local|hosted    local = full fix loop on the committed app. hosted = debug+check on live URLs. Default: local
  --interface <name>     browse | stagehand-act | stagehand-cdp. Default: browse
  --max-attempts <n>     Fix attempts before giving up. 1 = one-shot ablation. Default: 2
  --feedback full|failure-text
                         What a failed check feeds back to the fixer. "full" = the exact probe payload
                         (the winning strategy). "failure-text" = repair-loop ablation. Default: full
  --browserbase          Run every browser operation in a fresh Browserbase session (concurrency + replays)
  --concurrency <n>      Parallel bug evals. Default: 1 (use with --browserbase or stagehand interfaces)
  --score-evidence       Also score debugger handoff quality 1-5 (research metric)
  --results <dir>        Results directory. Default: results
  --report-only          Re-render aggregate.md from existing run records and exit
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return;
  }
  const resultsDir = argValue(args, "--results") ?? "results";
  if (args.includes("--report-only")) {
    const records = await readRecords(resultsDir);
    await writeFile(join(resultsDir, "aggregate.md"), renderAggregateMarkdown(records));
    console.log(renderAggregateMarkdown(records));
    return;
  }

  const targetDir = argValue(args, "--target") ?? "targets/starter";
  const mode = (argValue(args, "--mode") ?? "local") as "local" | "hosted";
  const bugFilter = argValue(args, "--bug")?.split(",").map((value) => value.trim()).filter(Boolean);
  const opts: LoopOptions = {
    iface: (argValue(args, "--interface") ?? "browse") as InterfaceName,
    maxAttempts: Number(argValue(args, "--max-attempts") ?? 2),
    feedback: (argValue(args, "--feedback") ?? "full") as FeedbackLevel,
    scoreEvidence: args.includes("--score-evidence"),
    browserbase: args.includes("--browserbase"),
    resultsDir
  };
  const concurrency = Number(argValue(args, "--concurrency") ?? 1);

  const targets = await loadSuite(targetDir);
  const cells: Array<{ target: Target; bug: BugSpec }> = [];
  for (const target of targets) {
    for (const bug of target.bugs) {
      if (bugFilter && !bugFilter.includes(bug.id)) continue;
      if (mode === "hosted" && !bug.hostedUrl) {
        console.warn(`Skipping ${target.name}/${bug.id}: no hosted URL.`);
        continue;
      }
      cells.push({ target, bug });
    }
  }
  if (cells.length === 0) throw new Error("Nothing to run: no bugs matched.");

  await mkdir(resultsDir, { recursive: true });
  console.log(`Running ${cells.length} bug eval(s) | mode=${mode} interface=${opts.iface} maxAttempts=${opts.maxAttempts} feedback=${opts.feedback}${opts.browserbase ? " browserbase" : ""}`);

  const records = await pool(cells, concurrency, async ({ target, bug }) => {
    console.log(`> ${target.name}/${bug.id}`);
    const record = mode === "hosted"
      ? await runHostedEval(target, bug, opts)
      : await runBugEval(target, bug, opts);
    await writeFile(join(record.artifacts.result_dir ?? resultsDir, "run.json"), `${JSON.stringify(record, null, 2)}\n`);
    console.log(`< ${target.name}/${bug.id}: ${record.error ? `ERROR ${record.error.message.slice(0, 120)}` : record.mode === "hosted" ? `bugConfirmed=${record.pre_fix_bug_confirmed}` : record.success ? `PASS (attempt ${record.attempts_used})` : "FAIL"}`);
    return record;
  });

  const allRecords = await readRecords(resultsDir);
  const aggregate = renderAggregateMarkdown(allRecords.length > 0 ? allRecords : records);
  await writeFile(join(resultsDir, "aggregate.md"), aggregate);
  console.log(`\n${aggregate}`);
}

async function pool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await fn(items[current]!);
    }
  });
  await Promise.all(workers);
  return results;
}

async function readRecords(resultsDir: string): Promise<RunRecord[]> {
  const records: RunRecord[] = [];
  let entries;
  try {
    entries = await readdir(resultsDir, { withFileTypes: true });
  } catch {
    return records;
  }
  for (const entry of entries.filter((e) => e.isDirectory())) {
    try {
      records.push(JSON.parse(await readFile(join(resultsDir, entry.name, "run.json"), "utf8")) as RunRecord);
    } catch {
      // incomplete run dir — skip
    }
  }
  return records.sort((a, b) => `${a.target}/${a.bugId}`.localeCompare(`${b.target}/${b.bugId}`));
}

function argValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

await main();
