import { promises as fs } from "node:fs";
import path from "node:path";
import { CONFIG } from "./config";
import { OUT_DIR, type FetchRecord } from "./fetchPdp";
import type { Extrapolation, MatrixCell, StageMetrics } from "./metrics";

// formatting helpers
export const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
export const secs = (msVal: number) => `${(msVal / 1000).toFixed(1)}s`;
export const usd = (x: number | null) => x === null ? "unknown" : `$${x.toFixed(2)}`;
const kb = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;
const pad = (s: string | number, n: number) => String(s).padEnd(n);
const padL = (s: string | number, n: number) => String(s).padStart(n);

export interface RunReport {
  mode: "ladder" | "matrix";
  startedAt: string;
  selection?: { competitor?: string; country?: string };
  config: {
    successThreshold: number;
    maxRetries: number;
    workers: number;
    planConcurrency: number;
    region: string;
    proxyUsdPerGb: number;
  };
  stages: StageMetrics[];
  extrapolation?: Extrapolation;
  matrix: MatrixCell[];
  gatedAtStage?: number;
  records: FetchRecord[];
}

export function printStageSummary(m: StageMetrics): void {
  console.log(
    `  ─ result: ${m.ok}/${m.attempted} ok  ·  ${pct(m.successRate)} success ` +
      `(${pct(m.firstPassRate)} first-pass)  ·  ${pct(m.blockRate)} blocked  ·  ${m.empty} empty`,
  );
  console.log(
    `    captcha: ${m.captchaSolved}/${m.captchaEncountered} solved  ·  ` +
      `URL elapsed p50 ${secs(m.latencyP50Ms)} / p95 ${secs(m.latencyP95Ms)}  ·  ` +
      `${kb(m.avgBytesPerAttempt)}/attempt; ${kb(m.avgBytesPerUrl)}/URL`,
  );
  console.log(
    `    stage wall-clock ${secs(m.wallClockMs)}; summed attempt work ${secs(m.totalAttemptDurationMs)}  ·  est cost ${usd(m.estCostUsd)}  ·  ` +
      `${m.totalAttempts} attempts (including allocation failures)`,
  );
}

export function printExtrapolation(e: Extrapolation): void {
  console.log(
    `\n📈 Extrapolation — ${e.to.toLocaleString()} URLs (from stage ${e.basisStage})`,
  );
  console.log(
    `   assumes measured success ${pct(e.successRate)} & ${kb(e.avgBytesPerUrl)}/URL including retries hold`,
  );
  console.log(`   expected successful URLs ≈ ${e.expectedSuccessfulUrls.toFixed(0)}; at ${e.planConcurrency} concurrent workers:`);
  console.log(
    `     • wall-clock   ≈ ${e.estWallClockMin.toFixed(0)} min (${(e.estWallClockMin / 60).toFixed(1)} h)`,
  );
  console.log(`     • proxy data   ≈ ${e.estProxyGb.toFixed(1)} GB`);
  console.log(
    `     • est cost     ≈ ${usd(e.estCostUsd)}  (${usd(e.perUrlCostUsd)}/URL)`,
  );
}

export function printMatrix(cells: MatrixCell[]): void {
  console.log(
    `\n🗺️  SAMPLE_ORG Baseline Evaluation Matrix (Process 2 — Daily URL Monitoring)`,
  );
  console.log(
    `   ${pad("Competitor", 12)}${pad("Ctry", 5)}${padL("OK/Try", 8)}${padL("Success", 9)}` +
      `${padL("1st-pass", 10)}${padL("p50", 8)}${padL("Daily cap*", 12)}`,
  );
  console.log(`   ${"-".repeat(64)}`);
  for (const c of cells) {
    console.log(
      `   ${pad(c.competitor, 12)}${pad(c.country, 5)}` +
        `${padL(`${c.ok}/${c.attempted}`, 8)}${padL(pct(c.successRate), 9)}` +
        `${padL(pct(c.firstPassRate), 10)}` +
        `${padL(secs(c.p50LatencyMs), 8)}${padL(c.estDailyCapacity.toLocaleString(), 12)}; expected successful/day ${c.estDailySuccessfulUrls.toLocaleString()}`,
    );
  }
  console.log(
    `   * est URLs/day at ${CONFIG.planConcurrency} concurrent workers given mean URL elapsed time including retries`,
  );
  console.log(
    `   (first-pass = success before any retry — SAMPLE_ORG's internal AliExpress baseline is ~50% first-pass)`,
  );
}

export async function writeRunReport(report: RunReport): Promise<string> {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const stamp = report.startedAt.replace(/[:.]/g, "-");
  const file = path.join(OUT_DIR, `run-${stamp}.json`);
  await fs.writeFile(file, JSON.stringify(report, null, 2));
  return file;
}
