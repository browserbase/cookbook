import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CONFIG,
  COMPETITORS,
  COUNTRIES,
  requireEnv,
  type Competitor,
  type Country,
} from "./config";
import { runStage } from "./runStage";
import { buildMatrix, extrapolate, type StageMetrics } from "./metrics";
import type { FetchInput, FetchRecord } from "./fetchPdp";
import {
  pct,
  printExtrapolation,
  printMatrix,
  printStageSummary,
  writeRunReport,
  type RunReport,
} from "./report";

const HERE = path.dirname(fileURLToPath(import.meta.url));

interface Seed {
  competitor: Competitor;
  country: Country;
  url: string;
  note?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// args + seeds
// ─────────────────────────────────────────────────────────────────────────────
function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

/**
 * Load the URL pool. Default: seeds/urls.json. `--seeds <file>` points at any file
 * with the same row shape — in particular the `output/pdp-urls-<competitor>-<country>.json`
 * lists that Process 1 (deep-dive) emits, so ladders run on real harvested URLs
 * instead of the placeholder seeds.
 */
async function loadSeeds(seedsPath?: string): Promise<Seed[]> {
  const p = seedsPath
    ? path.resolve(process.cwd(), seedsPath)
    : path.join(HERE, "..", "seeds", "urls.json");
  const raw = await fs.readFile(p, "utf8");
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error(`Seed file ${p} is empty or not a JSON array.`);
  }
  const bad = rows.findIndex(
    (r: any) => !r?.url || !r?.competitor || !r?.country,
  );
  if (bad !== -1) {
    throw new Error(
      `Seed file ${p} row ${bad} is missing url/competitor/country — expected the ` +
        `seeds/urls.json shape (deep-dive's pdp-urls-*.json output matches it).`,
    );
  }
  if (seedsPath) console.log(`🌱 seeds: ${p} (${rows.length} URLs)`);
  return rows as Seed[];
}

/** Repeat the seed pool to reach `n` fetches (daily monitoring re-hits the same
 *  URL set, so cycling is realistic). Payloads saved only for small stages. */
function expand(
  pool: Seed[],
  n: number,
  savePayload: boolean,
  parse: boolean,
): FetchInput[] {
  const inputs: FetchInput[] = [];
  for (let i = 0; i < n; i++) {
    const s = pool[i % pool.length];
    inputs.push({
      url: s.url,
      competitor: s.competitor,
      country: s.country,
      id: String(i),
      savePayload,
      parse,
    });
  }
  return inputs;
}

// Per-record progress line (throttled for big stages).
function onRecord(rec: FetchRecord, done: number, total: number): void {
  const verbose = total <= 100 || done % 50 === 0 || done === total;
  if (!verbose) return;
  const tag =
    rec.outcome === "ok" ? "✓" : rec.outcome === "blocked" ? "✗" : "∅";
  const cap = rec.captchaEncountered
    ? ` captcha ${rec.captchaSolved}/${rec.captchaEncountered}`
    : "";
  console.log(
    `  [${done}/${total}] ${tag} ${rec.outcome.padEnd(7)} ${rec.competitor}/${rec.country} ` +
      `URL ${((rec.elapsedMs ?? rec.durationMs) / 1000).toFixed(1)}s; work ${(rec.durationMs / 1000).toFixed(1)}s; observed ${(rec.bytes / 1024).toFixed(0)}KB${cap}` +
      (rec.outcome !== "ok" ? `  (${rec.reason})` : ""),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// modes
// ─────────────────────────────────────────────────────────────────────────────
async function runLadder(
  pool: Seed[],
  sel: { competitor: Competitor; country: Country },
  args: Record<string, string | boolean>,
): Promise<void> {
  const ladder = (
    args.stages
      ? String(args.stages).split(",").map(Number)
      : CONFIG.stageLadder
  ).filter((n) => Number.isFinite(n) && n > 0);
  const maxCap = args.max ? Number(args.max) : Infinity;
  const workers = args.workers ? Number(args.workers) : CONFIG.defaultWorkers;
  const threshold = args.threshold
    ? Number(args.threshold)
    : CONFIG.successThreshold;

  console.log(`\n🛡️  SAMPLE_ORG competitor monitor — anti-bot-at-scale ladder`);
  console.log(
    `   target: ${sel.competitor} / ${sel.country}   seeds: ${pool.length}`,
  );
  console.log(
    `   ladder: ${ladder.join(" → ")}   workers: ${workers}   gate: ≥${pct(threshold)} success`,
  );

  const stages: StageMetrics[] = [];
  const allRecords: FetchRecord[] = [];
  let lastMetrics: StageMetrics | null = null;
  let gatedAtStage: number | undefined;

  for (const n of ladder) {
    if (n > maxCap) {
      console.log(`\n(stopping before stage ${n}: exceeds --max ${maxCap})`);
      break;
    }
    console.log(`\n━━━ STAGE ${n} ━━━  (concurrency ${Math.min(workers, n)})`);
    const inputs = expand(
      pool,
      n,
      /* savePayload */ n <= 10,
      args.parse === true,
    );
    const { metrics, records } = await runStage(
      n,
      inputs,
      Math.min(workers, n),
      onRecord,
    );
    stages.push(metrics);
    allRecords.push(...records);
    lastMetrics = metrics;
    printStageSummary(metrics);

    if (metrics.successRate < threshold) {
      console.log(
        `\n⛔ GATE: success ${pct(metrics.successRate)} < ${pct(threshold)} — stopping ladder.`,
      );
      console.log(
        `   Iterate before scaling: try cityPrecision=false, a different region, more retries,\n` +
          `   or confirm verified-stealth/Scale-plan entitlements. Re-run this stage once tuned.`,
      );
      gatedAtStage = n;
      break;
    }
    console.log(
      `✅ GATE: success ${pct(metrics.successRate)} ≥ ${pct(threshold)} — advancing.`,
    );
  }

  const extrapolation =
    lastMetrics && !gatedAtStage
      ? extrapolate(lastMetrics, CONFIG.extrapolateTo)
      : undefined;
  if (extrapolation) printExtrapolation(extrapolation);
  else if (gatedAtStage)
    console.log(
      `\n(no 100k extrapolation — ladder gated at stage ${gatedAtStage})`,
    );

  const matrix = buildMatrix(allRecords);
  printMatrix(matrix);

  await finish("ladder", {
    stages,
    extrapolation,
    matrix,
    allRecords,
    sel,
    args,
    gatedAtStage,
  });
}

async function runMatrix(
  pool: Seed[],
  args: Record<string, string | boolean>,
): Promise<void> {
  const per = typeof args.matrix === "string" ? Number(args.matrix) || 10 : 10;
  const workers = args.workers ? Number(args.workers) : CONFIG.defaultWorkers;

  const cellKeys = [
    ...new Set(pool.map((s) => `${s.competitor}:${s.country}`)),
  ];
  console.log(
    `\n🗺️  SAMPLE_ORG matrix sweep — ${per} URLs × ${cellKeys.length} cells (workers ${workers})`,
  );

  const allRecords: FetchRecord[] = [];
  for (const key of cellKeys) {
    const [competitor, country] = key.split(":") as [Competitor, Country];
    const cellPool = pool.filter(
      (s) => s.competitor === competitor && s.country === country,
    );
    console.log(`\n━━━ ${competitor} / ${country} ━━━ (${per} fetches)`);
    const inputs = expand(
      cellPool,
      per,
      /* savePayload */ true,
      args.parse === true,
    );
    const { records } = await runStage(
      per,
      inputs,
      Math.min(workers, per),
      onRecord,
    );
    allRecords.push(...records);
  }

  const matrix = buildMatrix(allRecords);
  printMatrix(matrix);
  await finish("matrix", { stages: [], matrix, allRecords, args });
}

// ─────────────────────────────────────────────────────────────────────────────
// report writer
// ─────────────────────────────────────────────────────────────────────────────
async function finish(
  mode: "ladder" | "matrix",
  d: {
    stages: StageMetrics[];
    extrapolation?: ReturnType<typeof extrapolate>;
    matrix: ReturnType<typeof buildMatrix>;
    allRecords: FetchRecord[];
    sel?: { competitor: Competitor; country: Country };
    args: Record<string, string | boolean>;
    gatedAtStage?: number;
  },
): Promise<void> {
  const report: RunReport = {
    mode,
    startedAt: new Date().toISOString(),
    selection: d.sel,
    config: {
      successThreshold: d.args.threshold
        ? Number(d.args.threshold)
        : CONFIG.successThreshold,
      maxRetries: CONFIG.maxRetries,
      workers: d.args.workers ? Number(d.args.workers) : CONFIG.defaultWorkers,
      planConcurrency: CONFIG.planConcurrency,
      region: CONFIG.region,
      proxyUsdPerGb: CONFIG.proxyUsdPerGb,
    },
    stages: d.stages,
    extrapolation: d.extrapolation,
    matrix: d.matrix,
    gatedAtStage: d.gatedAtStage,
    records: d.allRecords,
  };
  const file = await writeRunReport(report);
  console.log(`\n📄 full report → ${file}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────
function printHelp(): void {
  console.log(`
SAMPLE_ORG competitor monitor — staged anti-bot-at-scale runner

Ladder mode (default): run the 1→10→100→1000 ladder for one competitor/country,
gating between stages on success rate, then extrapolate the 100k tier.

  npm start -- [--competitor shopee] [--country BR] [--stages 1,10,100]
               [--workers 10] [--threshold 0.95] [--max 100]
               [--seeds output/pdp-urls-aliexpress-BR.json] [--parse]

Matrix mode: run N URLs per (competitor,country) cell in the seeds and fill the
SAMPLE_ORG Baseline Evaluation Matrix.

  npm start -- --matrix 10 [--workers 10]

--seeds <file>  use a custom URL pool — deep-dive's output/pdp-urls-*.json files
                match the expected shape, wiring Process 1 harvests into Process 2.
--parse         ALSO run AI extraction per PDP (off by default: SAMPLE_ORG's deliverable
                is raw data; parse is slower and stays off the scale path).

Single URL (smoke test):
  npm run one -- "<pdp_url>" [country=BR] [competitor] [--parse]

Competitors: ${COMPETITORS.join(", ")}
Countries:   ${COUNTRIES.join(", ")}
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    printHelp();
    return;
  }

  requireEnv(); // fail fast with a clear message if BB creds are missing

  const pool = await loadSeeds(
    typeof args.seeds === "string" ? args.seeds : undefined,
  );

  if (args.matrix !== undefined) {
    await runMatrix(pool, args);
    return;
  }

  const competitor = (args.competitor as Competitor) ?? "shopee";
  const country = (args.country as Country) ?? "BR";
  if (!COMPETITORS.includes(competitor)) {
    console.error(
      `Unknown --competitor "${competitor}". One of: ${COMPETITORS.join(", ")}`,
    );
    process.exit(1);
  }
  if (!COUNTRIES.includes(country)) {
    console.error(
      `Unknown --country "${country}". One of: ${COUNTRIES.join(", ")}`,
    );
    process.exit(1);
  }

  const sel = pool.filter(
    (s) => s.competitor === competitor && s.country === country,
  );
  if (!sel.length) {
    console.error(
      `No seeds for ${competitor}/${country}. Add some to seeds/urls.json, point ` +
        `--seeds at a deep-dive pdp-urls-*.json, or try --matrix to sweep existing cells.`,
    );
    process.exit(1);
  }

  await runLadder(sel, { competitor, country }, args);
}

main().catch((e) => {
  // Clean one-liner for expected user errors (missing env, bad seeds); full
  // object otherwise to aid debugging.
  console.error(`\n${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
