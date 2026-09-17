import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";

const WORKFLOWS_DIR = resolve(process.cwd(), "workflows");

/** Shape we read out of each persisted trace (only the fields we aggregate). */
interface Trace {
  success?: boolean;
  downloadPath?: string;
  outputPath?: string;
  durationMs?: number;
  steps?: number;
  error?: string;
  message?: string;
  passed?: boolean;
  acceptanceVersion?: number;
}

interface LabelStats {
  label: string;
  total: number;
  passed: number;
  withFile: number;
  steps: number[];
  durationsMs: number[];
  failures: Record<string, number>;
}

/** A trace "passed" if the agent reported success OR a file was downloaded. */
function tracePassed(t: Trace): boolean {
  if (t.acceptanceVersion === 1 && typeof t.passed === "boolean") return t.passed;
  return t.success === true || !!t.downloadPath || !!t.outputPath;
}

/** Bucket a failed trace's error into a known category for the breakdown. */
function classifyFailure(t: Trace): string {
  const e = String(t.error || t.message || "unknown").toLowerCase();
  if (/too much media|images >|> 100/.test(e))
    return "too-much-media (100-image cap)";
  if (/prompt is too long/.test(e)) return "prompt too long";
  if (/rate limit|tokens per minute/.test(e)) return "rate limit";
  if (/timed out|timeout/.test(e)) return "timeout";
  if (/uuid|context\.id/.test(e)) return "bad context id";
  return "other";
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[Math.max(0, idx)];
}

async function readTraces(dir: string): Promise<Trace[]> {
  // Trace files are <short>.json; skip the <short>.output.json deliverable files.
  const files = (await readdir(dir)).filter(
    (f) => f.endsWith(".json") && !f.endsWith(".output.json"),
  );
  const out: Trace[] = [];
  for (const f of files) {
    try {
      out.push(JSON.parse(await readFile(join(dir, f), "utf8")) as Trace);
    } catch {
      // skip unreadable/partial trace
    }
  }
  return out;
}

function summarize(label: string, traces: Trace[]): LabelStats {
  const s: LabelStats = {
    label,
    total: traces.length,
    passed: 0,
    withFile: 0,
    steps: [],
    durationsMs: [],
    failures: {},
  };
  for (const t of traces) {
    const ok = tracePassed(t);
    if (ok) s.passed++;
    if (t.downloadPath) s.withFile++;
    if (ok) {
      // distributions over PASSED runs — that's what maxSteps should be tuned against
      if (typeof t.steps === "number") s.steps.push(t.steps);
      if (typeof t.durationMs === "number") s.durationsMs.push(t.durationMs);
    } else {
      const cat = classifyFailure(t);
      s.failures[cat] = (s.failures[cat] || 0) + 1;
    }
  }
  return s;
}

function pct(n: number, total: number): string {
  return total ? `${((100 * n) / total).toFixed(1)}%` : "0%";
}

/** Recommended maxSteps: above p95 with margin, never below the observed max. */
function recommendedMaxSteps(steps: number[]): number | null {
  if (steps.length === 0) return null;
  const sorted = [...steps].sort((a, b) => a - b);
  const p95 = percentile(sorted, 95);
  const max = sorted[sorted.length - 1];
  return Math.max(max, Math.ceil(p95 * 1.25));
}

async function currentMaxSteps(workflow: string): Promise<number | undefined> {
  const p = join(WORKFLOWS_DIR, workflow, "workflow.json");
  if (!existsSync(p)) return undefined;
  try {
    return (JSON.parse(await readFile(p, "utf8")) as { maxSteps?: number })
      .maxSteps;
  } catch {
    return undefined;
  }
}

function printLabel(s: LabelStats, current?: number): void {
  const steps = [...s.steps].sort((a, b) => a - b);
  const durs = [...s.durationsMs].sort((a, b) => a - b);
  const secs = (ms: number) => `${(ms / 1000).toFixed(0)}s`;

  console.log(`\n── ${s.label} ──`);
  console.log(
    `  runs: ${s.total}  ·  passed: ${s.passed} (${pct(s.passed, s.total)})  ·  with file: ${s.withFile} (${pct(s.withFile, s.total)})`,
  );
  if (steps.length) {
    console.log(
      `  steps (passed):    min ${steps[0]}  p50 ${percentile(steps, 50)}  p90 ${percentile(steps, 90)}  p95 ${percentile(steps, 95)}  max ${steps[steps.length - 1]}`,
    );
  }
  if (durs.length) {
    console.log(
      `  duration (passed): p50 ${secs(percentile(durs, 50))}  p90 ${secs(percentile(durs, 90))}  p95 ${secs(percentile(durs, 95))}  max ${secs(durs[durs.length - 1])}`,
    );
  }
  const failEntries = Object.entries(s.failures).sort((a, b) => b[1] - a[1]);
  if (failEntries.length) {
    console.log(
      `  failures: ${failEntries.map(([k, v]) => `${k} (${v})`).join(", ")}`,
    );
  }
  const rec = recommendedMaxSteps(s.steps);
  if (rec != null) {
    const cur = current != null ? `current ${current}` : "current unset";
    const hint =
      current != null && current !== rec ? `  ← consider ${rec}` : "";
    console.log(`  recommended maxSteps: ${rec}  (${cur})${hint}`);
  }
}

/** Aggregate and print stats for a workflow, optionally scoped to one label. */
export async function runStats(
  workflow: string,
  onlyLabel?: string,
): Promise<void> {
  const resultsRoot = join(WORKFLOWS_DIR, workflow, "results");
  if (!existsSync(resultsRoot)) {
    throw new Error(
      `No results found for "${workflow}" (expected ${resultsRoot}). Run it first.`,
    );
  }

  const entries = await readdir(resultsRoot, { withFileTypes: true });
  const labels = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((l) => !onlyLabel || l === onlyLabel)
    .sort();

  if (labels.length === 0) {
    throw new Error(
      onlyLabel
        ? `No results for label "${onlyLabel}" under ${resultsRoot}.`
        : `No labeled result folders under ${resultsRoot}.`,
    );
  }

  console.log(
    `Stats for "${workflow}"${onlyLabel ? ` · label ${onlyLabel}` : ""}`,
  );
  const current = await currentMaxSteps(workflow);
  for (const label of labels) {
    const traces = await readTraces(join(resultsRoot, label));
    if (traces.length === 0) continue;
    printLabel(summarize(label, traces), current);
  }
}
