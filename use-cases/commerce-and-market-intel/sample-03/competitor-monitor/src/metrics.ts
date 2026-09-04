import { CONFIG, type Competitor, type Country } from "./config";
import type { FetchRecord, AttemptTelemetry } from "./fetchPdp";

// ─────────────────────────────────────────────────────────────────────────────
// Per-stage aggregation
// ─────────────────────────────────────────────────────────────────────────────
export interface StageMetrics {
  stage: number; // requested fetch count for the stage
  attempted: number;
  ok: number;
  blocked: number;
  empty: number;
  successRate: number;
  /** Success on attempt #1, before any retry — SAMPLE_ORG's benchmark vocabulary (their
   *  internal AliExpress scraper: ~50% first-pass + heavy retries to recover). */
  firstPassOk: number;
  firstPassRate: number;
  blockRate: number;
  totalAttempts: number; // includes retries
  captchaEncountered: number;
  captchaSolved: number;
  captchaSolveRate: number;
  avgLatencyMs: number; // URL elapsed latency including retries and teardown
  latencyP50Ms: number;
  latencyP95Ms: number;
  totalBytes: number;
  avgBytesPerAttempt: number;
  avgBytesPerUrl: number;
  totalAttemptDurationMs: number;
  wallClockMs: number;
  estCostUsd: number | null;
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.floor((p / 100) * sortedAsc.length),
  );
  return sortedAsc[idx];
}

/** Historical retry records cannot reconstruct work that was never recorded. */
function attemptsFor(rec: FetchRecord): AttemptTelemetry[] {
  const history = rec.attemptHistory ?? (rec.attempts === 1 ? [{
    outcome: rec.outcome, durationMs: rec.durationMs, elapsedMs: rec.elapsedMs ?? rec.durationMs,
    bytes: rec.bytes, captchaEncountered: rec.captchaEncountered, captchaSolved: rec.captchaSolved,
    sessionId: rec.sessionId,
  }] : []);
  if (!Number.isInteger(rec.attempts) || rec.attempts < 1 || history.length !== rec.attempts)
    throw new Error("Incomplete retry telemetry; rerun the measurement before estimating costs or capacity.");
  for (const attempt of history) {
    if ([attempt.durationMs, attempt.elapsedMs, attempt.bytes, attempt.captchaEncountered, attempt.captchaSolved].some(value => !Number.isFinite(value) || value < 0))
      throw new Error("Invalid attempt telemetry");
  }
  return history;
}
function urlElapsed(rec: FetchRecord): number {
  const attempts = attemptsFor(rec);
  const elapsed = rec.elapsedMs ?? attempts.reduce((sum, a) => sum + a.elapsedMs, 0);
  if (!Number.isFinite(elapsed) || elapsed < 0) throw new Error("Invalid URL elapsed time");
  return elapsed;
}
/** Estimate using configured rates and assumed per-attempt minute/MB minimums, not invoice data. */
export function recordCostUsd(rec: FetchRecord): number | null {
  const attempts = attemptsFor(rec);
  if (attempts.some(attempt => !attempt.sessionId)) return null;
  return attempts.reduce((total, attempt) => {
    const minutes = Math.max(1, Math.ceil(attempt.elapsedMs / 60_000));
    const mb = Math.max(1, Math.ceil(attempt.bytes / 1e6));
    return total + minutes * (CONFIG.computeUsdPerHour / 60) + (mb / 1000) * CONFIG.proxyUsdPerGb;
  }, 0);
}

export function aggregate(
  records: FetchRecord[],
  stage: number,
  wallClockMs: number,
): StageMetrics {
  const attempted = records.length;
  const ok = records.filter((r) => r.outcome === "ok").length;
  const blocked = records.filter((r) => r.outcome === "blocked").length;
  const empty = records.filter((r) => r.outcome === "empty").length;
  // Older saved records predate firstAttemptOutcome; an ok with 1 attempt is by
  // definition a first-pass success, which keeps replayed reports honest.
  const firstPassOk = records.filter(
    (r) =>
      (r.firstAttemptOutcome ?? (r.attempts === 1 ? r.outcome : "blocked")) ===
      "ok",
  ).length;

  const attempts = records.flatMap(attemptsFor);
  const latencies = records.map(urlElapsed).sort((a, b) => a - b);
  const captchaEncountered = attempts.reduce(
    (s, r) => s + r.captchaEncountered,
    0,
  );
  const captchaSolved = attempts.reduce((s, r) => s + r.captchaSolved, 0);
  const totalBytes = attempts.reduce((s, r) => s + r.bytes, 0);
  const costs = records.map(recordCostUsd);
  const estCostUsd = costs.some(cost => cost === null) ? null : costs.reduce<number>((sum, cost) => sum + cost!, 0);

  return {
    stage,
    attempted,
    ok,
    blocked,
    empty,
    successRate: attempted ? ok / attempted : 0,
    firstPassOk,
    firstPassRate: attempted ? firstPassOk / attempted : 0,
    blockRate: attempted ? blocked / attempted : 0,
    totalAttempts: attempts.length,
    captchaEncountered,
    captchaSolved,
    captchaSolveRate: captchaEncountered
      ? captchaSolved / captchaEncountered
      : 1,
    avgLatencyMs: attempted
      ? latencies.reduce((s, x) => s + x, 0) / attempted
      : 0,
    latencyP50Ms: percentile(latencies, 50),
    latencyP95Ms: percentile(latencies, 95),
    totalBytes,
    avgBytesPerAttempt: attempts.length ? totalBytes / attempts.length : 0,
    avgBytesPerUrl: attempted ? totalBytes / attempted : 0,
    totalAttemptDurationMs: attempts.reduce((sum, a) => sum + a.durationMs, 0),
    wallClockMs,
    estCostUsd,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Extrapolation: project the 100k tier from the largest measured stage
// ─────────────────────────────────────────────────────────────────────────────
export interface Extrapolation {
  avgBytesPerUrl: number;
  basisStage: number;
  to: number;
  successRate: number;
  avgLatencyMs: number;
  avgBytesPerAttempt: number;
  planConcurrency: number;
  estWallClockMin: number;
  estProxyGb: number;
  estCostUsd: number | null;
  perUrlCostUsd: number | null;
  expectedSuccessfulUrls: number;
}

export function extrapolate(
  basis: StageMetrics,
  to = CONFIG.extrapolateTo,
): Extrapolation {
  const perUrlCostUsd = basis.estCostUsd === null ? null : basis.attempted
    ? basis.estCostUsd / basis.attempted
    : 0;
  const estProxyGb = (basis.avgBytesPerUrl * to) / 1e9;
  // At assumed URL-worker concurrency, wall-clock includes retries and teardown.
  const estWallClockMin =
    ((to / CONFIG.planConcurrency) * basis.avgLatencyMs) / 60_000;
  return {
    basisStage: basis.stage,
    to,
    successRate: basis.successRate,
    avgLatencyMs: basis.avgLatencyMs,
    avgBytesPerAttempt: basis.avgBytesPerAttempt,
    avgBytesPerUrl: basis.avgBytesPerUrl,
    planConcurrency: CONFIG.planConcurrency,
    estWallClockMin,
    estProxyGb,
    estCostUsd: perUrlCostUsd === null ? null : perUrlCostUsd * to,
    perUrlCostUsd,
    expectedSuccessfulUrls: basis.successRate * to,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SAMPLE_ORG Baseline Evaluation Matrix (competitor × country)
// ─────────────────────────────────────────────────────────────────────────────
export interface MatrixCell {
  competitor: Competitor;
  country: Country;
  attempted: number;
  ok: number;
  successRate: number;
  /** Success before any retry — comparable to SAMPLE_ORG's internal first-pass numbers. */
  firstPassRate: number;
  p50LatencyMs: number;
  /** Daily URL-monitoring capacity at plan concurrency, given mean URL elapsed time. */
  estDailyCapacity: number; // attempted URLs, including unsuccessful results
  estDailySuccessfulUrls: number;
}

export function buildMatrix(records: FetchRecord[]): MatrixCell[] {
  const groups = new Map<string, FetchRecord[]>();
  for (const r of records) {
    const key = `${r.competitor}:${r.country}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }

  const cells: MatrixCell[] = [];
  for (const [key, recs] of groups) {
    const [competitor, country] = key.split(":") as [Competitor, Country];
    const ok = recs.filter((r) => r.outcome === "ok").length;
    const firstPassOk = recs.filter(
      (r) =>
        (r.firstAttemptOutcome ??
          (r.attempts === 1 ? r.outcome : "blocked")) === "ok",
    ).length;
    const latencies = recs.map(urlElapsed).sort((a, b) => a - b);
    const p50 = percentile(latencies, 50);
    const mean = latencies.reduce((sum, value) => sum + value, 0) / latencies.length;
    const throughputPerSec = mean > 0 ? CONFIG.planConcurrency / (mean / 1000) : 0;
    cells.push({
      competitor,
      country,
      attempted: recs.length,
      ok,
      successRate: recs.length ? ok / recs.length : 0,
      firstPassRate: recs.length ? firstPassOk / recs.length : 0,
      p50LatencyMs: p50,
      estDailyCapacity: Math.round(throughputPerSec * 86_400),
      estDailySuccessfulUrls: Math.round(throughputPerSec * 86_400 * ok / recs.length),
    });
  }
  return cells.sort(
    (a, b) =>
      a.competitor.localeCompare(b.competitor) ||
      a.country.localeCompare(b.country),
  );
}
