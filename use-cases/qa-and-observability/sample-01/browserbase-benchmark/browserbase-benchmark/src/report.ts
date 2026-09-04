import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import type { RunResult, NavigationTiming, PageMetrics } from "./types.js";
import { calculateCosts } from "./cost.js";

// ---------------------------------------------------------------------------
// Backward-compatibility migration
// ---------------------------------------------------------------------------
// Supports results files written by the old benchmark.ts (pre-generalization).
// Old format: { runner, host, phases: { init, goto, screenshot, extract, act, total }, navigation, page, sessionId }
// New format: { competitor, scenario, steps: { init, goto, ... }, total, metadata: { host, navigation, page, sessionId } }

function migrateResult(raw: unknown): RunResult {
  const r = raw as Record<string, unknown>;
  if ("phases" in r && "runner" in r) {
    const phases = r.phases as Record<string, number>;
    const { total: phaseTotal, ...stepData } = phases;
    return {
      competitor: r.runner === "browserbase" ? "browserbase" : "local-chromium",
      scenario: "basic-navigation",
      site: r.site as string,
      runIndex: r.runIndex as number,
      steps: stepData,
      total: phaseTotal ?? Object.values(stepData).reduce((a, b) => a + b, 0),
      metadata: {
        host: r.host,
        sessionId: r.sessionId,
        navigation: r.navigation,
        page: r.page,
      },
      error: r.error as string | undefined,
    };
  }
  return raw as RunResult;
}

// ---------------------------------------------------------------------------
// File loading
// ---------------------------------------------------------------------------

function loadResults(filePath?: string): RunResult[] {
  if (filePath) {
    const abs = resolve(process.cwd(), filePath);
    console.log(`Loading results from: ${abs}`);
    const data = JSON.parse(readFileSync(abs, "utf-8")) as unknown[];
    return data.map(migrateResult);
  }

  const resultsDir = join(process.cwd(), "results");
  const files = readdirSync(resultsDir).filter((f) => f.endsWith(".json")).sort().reverse();
  if (files.length === 0) throw new Error("No results found in ./results/. Run the benchmark first.");
  const latest = join(resultsDir, files[0]);
  console.log(`Loading results from: ${latest}`);
  const data = JSON.parse(readFileSync(latest, "utf-8")) as unknown[];
  return data.map(migrateResult);
}

// ---------------------------------------------------------------------------
// Fast-cluster detection (Browserbase-specific)
// CDP overhead = goto phase duration - W3C navigation timing sum
// ---------------------------------------------------------------------------

const CDP_FAST_THRESHOLD = 600; // ms — natural valley between the two routing-path humps

interface FastClusterInfo {
  fastResults: RunResult[];
  fastCount: number;
  totalBBCount: number;
  fastPct: number;
  allCdpValues: number[];
}

function getFastClusterInfo(results: RunResult[]): FastClusterInfo {
  const bbWithNav = results.filter(
    (r) => r.competitor === "browserbase" && !r.error && r.metadata?.navigation,
  );
  const totalBBCount = bbWithNav.length;
  const fastResults: RunResult[] = [];
  const allCdpValues: number[] = [];

  for (const r of bbWithNav) {
    const n = r.metadata!.navigation as NavigationTiming;
    const navSum = n.dns + n.tcp + n.tls + n.ttfb + n.download + n.domContentLoaded;
    const cdp = (r.steps.goto ?? 0) - navSum;
    allCdpValues.push(cdp);
    if (cdp < CDP_FAST_THRESHOLD) fastResults.push(r);
  }

  return {
    fastResults,
    fastCount: fastResults.length,
    totalBBCount,
    fastPct: totalBBCount > 0 ? Math.round((fastResults.length / totalBBCount) * 100) : 0,
    allCdpValues: [...allCdpValues].sort((a, b) => a - b),
  };
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

function hostname(site: string): string {
  try { return new URL(site).hostname; } catch { return site; }
}

function mean(vals: number[]): number {
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
function percentile(vals: number[], pct: number): number {
  const sorted = [...vals].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * pct) - 1)];
}
function median(vals: number[]): number { return percentile(vals, 0.5); }
function p25(vals: number[]): number    { return percentile(vals, 0.25); }
function p75(vals: number[]): number    { return percentile(vals, 0.75); }

// Discover all step names that appear in results, with 'init' first
function discoverStepNames(results: RunResult[]): string[] {
  const set = new Set<string>();
  for (const r of results) if (!r.error) Object.keys(r.steps).forEach((k) => set.add(k));
  const names = [...set].filter((n) => n !== "total");
  names.sort((a, b) => (a === "init" ? -1 : b === "init" ? 1 : 0));
  return names;
}

const STEP_COLOR_PALETTE = [
  "#6366f1", "#22d3ee", "#a78bfa", "#f59e0b",
  "#10b981", "#f43f5e", "#fb923c", "#84cc16",
];
function stepColors(stepNames: string[]): Record<string, string> {
  return Object.fromEntries(
    stepNames.map((name, i) => [name, STEP_COLOR_PALETTE[i % STEP_COLOR_PALETTE.length]]),
  );
}

type NavKey = "dns" | "tcp" | "tls" | "ttfb" | "download" | "domContentLoaded";
const NAV_KEYS: NavKey[] = ["dns", "tcp", "tls", "ttfb", "download", "domContentLoaded"];
const NAV_COLORS: Record<NavKey, string> = {
  dns: "#f472b6", tcp: "#fb923c", tls: "#facc15",
  ttfb: "#4ade80", download: "#38bdf8", domContentLoaded: "#a78bfa",
};

interface SeriesKey {
  label: string;
  competitor: string;
  host: string;
}

interface StepStat { mean: number; median: number; p25: number; p75: number; p95: number; }
interface SiteStats {
  site: string;
  series: Array<SeriesKey & { steps: Record<string, StepStat> }>;
  sampleCount: number;
}
interface NavStats {
  site: string;
  series: Array<SeriesKey & { nav: Record<NavKey, number> }>;
}
interface CdpStats {
  site: string;
  series: Array<SeriesKey & { pageLoadMs: number; cdpOverheadMs: number; gotoMs: number }>;
}
interface PageStats {
  site: string;
  domNodes: number;
  resources: number;
  transferBytes: number;
}

function hostLabel(host: string | undefined): string {
  switch (host) {
    case "ec2": return "EC2";
    case "render": return "Render";
    default: return "Local";
  }
}

function getHost(r: RunResult): string {
  return (r.metadata?.host as string | undefined) ?? "local-machine";
}

function computeStats(results: RunResult[], stepNames: string[]): SiteStats[] {
  const sites = [...new Set(results.map((r) => r.site))];

  return sites.map((site) => {
    const siteResults = results.filter((r) => r.site === site && !r.error);

    const seen = new Map<string, SeriesKey>();
    for (const r of siteResults) {
      const h = getHost(r);
      const key = `${h}::${r.competitor}`;
      if (!seen.has(key)) {
        seen.set(key, {
          label: `${hostLabel(h)} – ${r.competitor}`,
          competitor: r.competitor,
          host: h,
        });
      }
    }

    const stat = (rows: RunResult[], step: string): StepStat => {
      // "total" is a top-level field on RunResult, not inside steps.
      // All other steps live in r.steps — only include runs where the step was
      // actually recorded (undefined means a different scenario ran, not a skipped step).
      const vals = step === "total"
        ? rows.filter((r) => r.total !== undefined).map((r) => r.total)
        : rows.filter((r) => r.steps[step] !== undefined).map((r) => r.steps[step]!);
      if (vals.length === 0) return { mean: 0, median: 0, p25: 0, p75: 0, p95: 0 };
      return {
        mean:   Math.round(mean(vals)),
        median: Math.round(median(vals)),
        p25:    Math.round(p25(vals)),
        p75:    Math.round(p75(vals)),
        p95:    Math.round(percentile(vals, 0.95)),
      };
    };

    const series = Array.from(seen.values()).map((sk) => {
      const rows = siteResults.filter(
        (r) => r.competitor === sk.competitor && getHost(r) === sk.host,
      );
      const steps = Object.fromEntries(
        [...stepNames, "total"].map((step) => [step, stat(rows, step)]),
      );
      return { ...sk, steps };
    });

    return {
      site,
      series,
      sampleCount: Math.max(
        ...series.map((s) =>
          siteResults.filter((r) => r.competitor === s.competitor && getHost(r) === s.host).length,
        ),
        0,
      ),
    };
  });
}

function computeNavStats(results: RunResult[]): NavStats[] {
  const sites = [...new Set(results.map((r) => r.site))];
  return sites.map((site) => {
    const siteResults = results.filter(
      (r) => r.site === site && !r.error && !!r.metadata?.navigation,
    );
    const seen = new Map<string, SeriesKey>();
    for (const r of siteResults) {
      const h = getHost(r);
      const key = `${h}::${r.competitor}`;
      if (!seen.has(key)) {
        seen.set(key, { label: `${hostLabel(h)} – ${r.competitor}`, competitor: r.competitor, host: h });
      }
    }
    const series = Array.from(seen.values()).map((sk) => {
      const rows = siteResults.filter(
        (r) => r.competitor === sk.competitor && getHost(r) === sk.host,
      );
      const nav = Object.fromEntries(
        NAV_KEYS.map((k) => {
          const vals = rows.map((r) => (r.metadata!.navigation as NavigationTiming)[k]);
          return [k, vals.length > 0 ? Math.round(median(vals)) : 0];
        }),
      ) as Record<NavKey, number>;
      return { ...sk, nav };
    });
    return { site, series };
  });
}

function computeCdpStats(results: RunResult[]): CdpStats[] {
  const sites = [...new Set(results.map((r) => r.site))];
  return sites.map((site) => {
    const siteResults = results.filter(
      (r) => r.site === site && !r.error && !!r.metadata?.navigation,
    );
    const seen = new Map<string, SeriesKey>();
    for (const r of siteResults) {
      const h = getHost(r);
      const key = `${h}::${r.competitor}`;
      if (!seen.has(key)) {
        seen.set(key, { label: `${hostLabel(h)} – ${r.competitor}`, competitor: r.competitor, host: h });
      }
    }
    const series = Array.from(seen.values()).map((sk) => {
      const rows = siteResults.filter(
        (r) => r.competitor === sk.competitor && getHost(r) === sk.host,
      );
      const medGoto = rows.length > 0 ? Math.round(median(rows.map((r) => r.steps.goto ?? 0))) : 0;
      const medNavSum =
        rows.length > 0
          ? Math.round(
              median(
                rows.map((r) => {
                  const n = r.metadata!.navigation as NavigationTiming;
                  return n.dns + n.tcp + n.tls + n.ttfb + n.download + n.domContentLoaded;
                }),
              ),
            )
          : 0;
      return {
        ...sk,
        gotoMs: medGoto,
        pageLoadMs: medNavSum,
        cdpOverheadMs: Math.max(0, medGoto - medNavSum),
      };
    });
    return { site, series };
  });
}

function computePageStats(results: RunResult[]): PageStats[] {
  const sites = [...new Set(results.map((r) => r.site))];
  return sites.map((site) => {
    const rows = results.filter((r) => r.site === site && !r.error && !!r.metadata?.page);
    if (rows.length === 0) return { site, domNodes: 0, resources: 0, transferBytes: 0 };
    return {
      site,
      domNodes: Math.round(mean(rows.map((r) => (r.metadata!.page as PageMetrics).domNodes))),
      resources: Math.round(mean(rows.map((r) => (r.metadata!.page as PageMetrics).resources))),
      transferBytes: Math.round(mean(rows.map((r) => (r.metadata!.page as PageMetrics).transferBytes))),
    };
  });
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function fmtMs(ms: number): string { return (ms / 1000).toFixed(3) + "s"; }

// ---------------------------------------------------------------------------
// HTML template
// ---------------------------------------------------------------------------

interface ReportMeta {
  fastCount: number;
  totalBBCount: number;
  fastPct: number;
  allBBCdpValues: number[];
  selfHostedLabel: string;
  competitorNames: string[];
}

function buildHtml(
  stats: SiteStats[],
  navStats: NavStats[],
  cdpStats: CdpStats[],
  pageStats: PageStats[],
  results: RunResult[],
  meta: ReportMeta,
  stepNames: string[],
): string {
  const COLORS = stepColors(stepNames);
  const competitorNames = meta.competitorNames;

  // Find the first non-browserbase competitor (self-hosted baseline for comparison callout)
  const selfHostedName = competitorNames.find((c) => c !== "browserbase") ?? competitorNames[0];
  const hasBB = results.some((r) => r.competitor === "browserbase" && !r.error);
  const hasSelfHosted = results.some((r) => r.competitor === selfHostedName && !r.error);
  const hasNav = results.some((r) => !!r.metadata?.navigation);

  // Competitors that have results with goto steps (for CDP analysis)
  const hasCdpData = cdpStats.some((cs) => cs.series.length > 0) && (steps => steps.includes("goto"))(stepNames);

  // Median total overhead across all sites that have both self-hosted and BB
  const sitesWithBoth = stats.filter(
    (s) =>
      s.series.some((sr) => sr.competitor === selfHostedName) &&
      s.series.some((sr) => sr.competitor === "browserbase"),
  );
  const avgOverheadMs =
    sitesWithBoth.length > 0
      ? Math.round(
          sitesWithBoth.reduce((sum, s) => {
            const loc = s.series.find((sr) => sr.competitor === selfHostedName)!;
            const bb = s.series.find((sr) => sr.competitor === "browserbase")!;
            return sum + (bb.steps.total.median - loc.steps.total.median);
          }, 0) / sitesWithBoth.length,
        )
      : 0;
  const avgLocalMedian =
    sitesWithBoth.length > 0
      ? sitesWithBoth.reduce(
          (sum, s) =>
            sum + (s.series.find((sr) => sr.competitor === selfHostedName)?.steps.total.median ?? 0),
          0,
        ) / sitesWithBoth.length
      : 0;
  const avgOverheadPct =
    avgLocalMedian > 0 ? ((avgOverheadMs / avgLocalMedian) * 100).toFixed(1) : "0";

  // Per-step overhead for callout breakdown table
  const perStepOverhead = stepNames.map((step) => {
    const localMeds = sitesWithBoth.map(
      (s) => s.series.find((sr) => sr.competitor === selfHostedName)?.steps[step]?.median ?? 0,
    );
    const bbMeds = sitesWithBoth.map(
      (s) => s.series.find((sr) => sr.competitor === "browserbase")?.steps[step]?.median ?? 0,
    );
    const localP25s = sitesWithBoth.map(
      (s) => s.series.find((sr) => sr.competitor === selfHostedName)?.steps[step]?.p25 ?? 0,
    );
    const localP75s = sitesWithBoth.map(
      (s) => s.series.find((sr) => sr.competitor === selfHostedName)?.steps[step]?.p75 ?? 0,
    );
    const bbP25s = sitesWithBoth.map(
      (s) => s.series.find((sr) => sr.competitor === "browserbase")?.steps[step]?.p25 ?? 0,
    );
    const bbP75s = sitesWithBoth.map(
      (s) => s.series.find((sr) => sr.competitor === "browserbase")?.steps[step]?.p75 ?? 0,
    );
    const avg = (arr: number[]) =>
      arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    return {
      step,
      avgLocal: avg(localMeds),
      avgBB: avg(bbMeds),
      diff: avg(bbMeds) - avg(localMeds),
      avgLocalP25: avg(localP25s),
      avgLocalP75: avg(localP75s),
      avgBbP25: avg(bbP25s),
      avgBbP75: avg(bbP75s),
    };
  });

  // Waterfall datasets per site
  const allWaterfallData = stats.map((s) => ({
    site: hostname(s.site),
    labels: s.series.map((sr) => sr.label),
    datasets: stepNames.map((step) => ({
      label: step,
      data: s.series.map((sr) => sr.steps[step]?.median ?? 0),
      p25: s.series.map((sr) => sr.steps[step]?.p25 ?? 0),
      p75: s.series.map((sr) => sr.steps[step]?.p75 ?? 0),
      backgroundColor: COLORS[step],
    })),
  }));

  // CDP breakdown averaged across sites
  const sitesWithCdpBoth = cdpStats.filter(
    (cs) =>
      cs.series.some((sr) => sr.competitor === selfHostedName) &&
      cs.series.some((sr) => sr.competitor === "browserbase"),
  );
  const avgCdpLocal =
    sitesWithCdpBoth.length > 0
      ? Math.round(
          sitesWithCdpBoth.reduce(
            (sum, cs) =>
              sum + (cs.series.find((sr) => sr.competitor === selfHostedName)?.cdpOverheadMs ?? 0),
            0,
          ) / sitesWithCdpBoth.length,
        )
      : null;
  const avgCdpBB =
    sitesWithCdpBoth.length > 0
      ? Math.round(
          sitesWithCdpBoth.reduce(
            (sum, cs) =>
              sum + (cs.series.find((sr) => sr.competitor === "browserbase")?.cdpOverheadMs ?? 0),
            0,
          ) / sitesWithCdpBoth.length,
        )
      : null;
  const avgPageLoadLocal =
    sitesWithCdpBoth.length > 0
      ? Math.round(
          sitesWithCdpBoth.reduce(
            (sum, cs) =>
              sum + (cs.series.find((sr) => sr.competitor === selfHostedName)?.pageLoadMs ?? 0),
            0,
          ) / sitesWithCdpBoth.length,
        )
      : null;
  const avgPageLoadBB =
    sitesWithCdpBoth.length > 0
      ? Math.round(
          sitesWithCdpBoth.reduce(
            (sum, cs) =>
              sum + (cs.series.find((sr) => sr.competitor === "browserbase")?.pageLoadMs ?? 0),
            0,
          ) / sitesWithCdpBoth.length,
        )
      : null;

  const allCdpData = cdpStats.map((cs) => ({
    site: hostname(cs.site),
    labels: cs.series.map((sr) => sr.label),
    datasets: [
      {
        label: "Page load (W3C nav sum)",
        data: cs.series.map((sr) => sr.pageLoadMs),
        backgroundColor: "#22d3ee",
      },
      {
        label: "CDP overhead",
        data: cs.series.map((sr) => sr.cdpOverheadMs),
        backgroundColor: "#6366f1",
      },
    ],
  }));

  const allNavData = navStats.map((ns) => ({
    site: hostname(ns.site),
    labels: ns.series.map((sr) => sr.label),
    datasets: NAV_KEYS.map((k) => ({
      label: k === "domContentLoaded" ? "DCL event" : k.toUpperCase(),
      data: ns.series.map((sr) => sr.nav[k]),
      backgroundColor: NAV_COLORS[k],
    })),
  }));

  // Cost analysis (only when Browserbase is present)
  const avgBBTotalMs =
    hasBB
      ? Math.round(
          mean(
            results
              .filter((r) => r.competitor === "browserbase" && !r.error)
              .map((r) => r.total),
          ),
        )
      : undefined;
  const costBreakdown = hasBB
    ? calculateCosts({
        sessionsPerDay: parseInt(process.env.SESSIONS_PER_DAY ?? "100", 10),
        avgSessionMinutes: parseFloat(process.env.AVG_SESSION_MINUTES ?? "5"),
        avgBrowserMs: avgBBTotalMs,
        opsHoursPerMonth: Number(process.env.OPS_HOURS ?? "8"),
      })
    : null;

  const chartJs = `https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js`;

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Browserbase Benchmark Report</title>
  <script src="${chartJs}"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f172a; color: #e2e8f0; }
    header { background: #1e293b; padding: 2rem; border-bottom: 1px solid #334155; display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    header h1 { font-size: 1.6rem; font-weight: 700; color: #f1f5f9; }
    header p { margin-top: .5rem; color: #94a3b8; font-size: .9rem; }
    .print-btn { flex-shrink: 0; display: inline-flex; align-items: center; gap: .4rem; background: #1e3a5f; border: 1px solid #2563eb; color: #93c5fd; font-size: .85rem; font-weight: 600; padding: .5rem 1rem; border-radius: .5rem; cursor: pointer; transition: all .15s; white-space: nowrap; }
    .print-btn:hover { background: #1d4ed8; border-color: #3b82f6; color: #fff; }
    @media print { .print-btn { display: none; } }
    main { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }
    section { margin-bottom: 2.5rem; }
    h2 { font-size: 1.15rem; font-weight: 600; color: #cbd5e1; margin-bottom: 1rem; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: .75rem; padding: 1.5rem; }
    .chart-wrap { position: relative; height: 320px; }
    .chart-wrap-sm { position: relative; height: 200px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    @media (max-width: 700px) { .grid-2 { grid-template-columns: 1fr; } }
    .callout { background: linear-gradient(135deg, #1e293b, #0f172a); border: 1px solid #6366f1; border-radius: .75rem; padding: 1.5rem 2rem; display: flex; align-items: center; gap: 2rem; flex-wrap: wrap; }
    .callout-num { font-size: 2.5rem; font-weight: 800; color: #818cf8; }
    .callout-label { color: #94a3b8; font-size: .9rem; margin-top: .25rem; }
    .callout-desc { color: #cbd5e1; font-size: .95rem; max-width: 500px; }
    table { width: 100%; border-collapse: collapse; font-size: .9rem; }
    th { text-align: left; padding: .6rem 1rem; background: #0f172a; color: #94a3b8; font-weight: 600; border-bottom: 1px solid #334155; }
    td { padding: .7rem 1rem; border-bottom: 1px solid #1e293b; }
    tr:last-child td { border-bottom: none; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .green { color: #34d399; }
    .red { color: #f87171; }
    .muted { color: #64748b; font-size: .8rem; }
    .legend { display: flex; flex-wrap: wrap; gap: .5rem 1rem; margin-top: 1rem; font-size: .82rem; color: #94a3b8; }
    .legend-dot { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: .3rem; vertical-align: middle; }
    .tco-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    @media (max-width: 700px) { .tco-grid { grid-template-columns: 1fr; } }
    .pill { display: inline-block; font-size: .75rem; font-weight: 600; padding: .15rem .5rem; border-radius: 999px; margin-left: .4rem; vertical-align: middle; }
    .pill-green { background: #14532d; color: #4ade80; }
    .pill-red   { background: #450a0a; color: #f87171; }
    .pill-blue  { background: #1e3a5f; color: #38bdf8; }
    .breakeven-row td { background: #1e3a5f; color: #38bdf8; font-weight: 600; }
    .section-note { color: #64748b; font-size: .8rem; margin-top: .75rem; line-height: 1.5; }
    .info-icon { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background: #334155; color: #94a3b8; font-size: .7rem; font-weight: 700; cursor: default; margin-left: .4rem; vertical-align: middle; position: relative; }
    .info-icon:hover { background: #475569; color: #e2e8f0; }
    .info-icon .tooltip { display: none; position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); background: #1e293b; border: 1px solid #475569; border-radius: .5rem; padding: .75rem 1rem; width: 320px; font-size: .8rem; line-height: 1.55; color: #cbd5e1; font-weight: 400; white-space: normal; z-index: 10; pointer-events: none; box-shadow: 0 8px 24px #00000066; }
    .info-icon .tooltip::after { content: ""; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 6px solid transparent; border-top-color: #475569; }
    .info-icon:hover .tooltip { display: block; }
    .tab-bar { display: flex; gap: .4rem; flex-wrap: wrap; }
    .tab-btn { background: #0f172a; border: 1px solid #334155; color: #94a3b8; padding: .35rem .85rem; border-radius: .4rem; cursor: pointer; font-size: .85rem; transition: all .15s; }
    .tab-btn:hover { border-color: #6366f1; color: #e2e8f0; }
    .tab-btn.active { background: #312e81; border-color: #6366f1; color: #e2e8f0; font-weight: 600; }
    .errors { background: #450a0a; border: 1px solid #991b1b; border-radius: .5rem; padding: 1rem 1.25rem; color: #fca5a5; font-size: .85rem; }
    .errors ul { margin-top: .5rem; padding-left: 1.25rem; }
  </style>
</head>
<body>
<header>
  <div>
    <h1>Browserbase Benchmark Report</h1>
    <p>Generated ${new Date().toLocaleString()} &nbsp;·&nbsp;
       Scenario: ${escapeHtml(results[0]?.scenario ?? "unspecified")} &nbsp;·&nbsp;
       ${[...new Set(results.map((r) => r.site))].length} site(s) &nbsp;·&nbsp;
       ${competitorNames.map((c) => `<strong style="color:#e2e8f0">${c}</strong>`).join(" vs ")}
       ${hasBB ? `&nbsp;·&nbsp; <strong style="color:#22d3ee">${meta.fastCount}</strong> Browserbase observations below the ${CDP_FAST_THRESHOLD}ms threshold (${meta.fastPct}% of ${meta.totalBBCount} measured observations)` : ""}
    </p>
  </div>
  <button class="print-btn" onclick="exportPdf()">⬇ Export PDF</button>
</header>
<main>

${(() => {
  const errors = results.filter((r) => r.error);
  if (errors.length === 0) return "";
  return `<section>
  <div class="errors">
    <strong>${errors.length} run(s) failed:</strong>
    <ul>${errors.map((e) => `<li>[${e.competitor}] ${e.site} run ${e.runIndex + 1}: ${e.error}</li>`).join("")}</ul>
  </div>
</section>`;
})()}

${hasBB && hasSelfHosted && sitesWithBoth.length > 0 ? `
<section>
  <div class="callout">
    <div style="flex:1;min-width:280px">
      <div style="font-size:.8rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem">
        Mean of per-site median differences · ${selfHostedName} (${meta.selfHostedLabel}) vs Browserbase (all successful observations)
      </div>
      <div>
        <div class="callout-num">${avgOverheadMs > 0 ? "+" : ""}${fmtMs(avgOverheadMs)}</div>
        <div class="callout-label">${avgOverheadPct}% overhead relative to the mean self-hosted site median</div>
      </div>
      <table style="font-size:.85rem;width:100%;margin-top:1rem">
        <thead>
          <tr>
            <th style="background:transparent;color:#64748b;padding:.35rem .6rem;font-weight:500">Step</th>
            <th style="background:transparent;color:#64748b;padding:.35rem .6rem;text-align:right;font-weight:500">${selfHostedName} (p25–p75)</th>
            <th style="background:transparent;color:#64748b;padding:.35rem .6rem;text-align:right;font-weight:500">Browserbase (p25–p75)</th>
            <th style="background:transparent;color:#64748b;padding:.35rem .6rem;text-align:right;font-weight:500">Difference</th>
          </tr>
        </thead>
        <tbody>
          ${perStepOverhead.map((r) => {
            const skipped = r.avgLocal === 0 && r.avgBB === 0;
            const tdStyle = `padding:.35rem .6rem;border-top:1px solid #1e2940;${skipped ? "text-decoration:line-through;opacity:.4;" : ""}`;
            const diffColor = r.diff > 0 ? "#94a3b8" : r.diff < 0 ? "#34d399" : "#64748b";
            const localRange = skipped ? "" : `<span style="color:#475569;font-size:.75rem"> (${fmtMs(r.avgLocalP25)}–${fmtMs(r.avgLocalP75)})</span>`;
            const bbRange = skipped ? "" : `<span style="color:#475569;font-size:.75rem"> (${fmtMs(r.avgBbP25)}–${fmtMs(r.avgBbP75)})</span>`;
            return `<tr>
              <td style="${tdStyle}color:#cbd5e1">${r.step}</td>
              <td style="${tdStyle}text-align:right;font-variant-numeric:tabular-nums;color:#94a3b8">${skipped ? "skipped" : fmtMs(r.avgLocal) + localRange}</td>
              <td style="${tdStyle}text-align:right;font-variant-numeric:tabular-nums;color:#94a3b8">${skipped ? "skipped" : fmtMs(r.avgBB) + bbRange}</td>
              <td style="${tdStyle}text-align:right;font-variant-numeric:tabular-nums;color:${diffColor}">${skipped ? "—" : (r.diff > 0 ? "+" : "") + fmtMs(r.diff)}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
    <div style="min-width:220px;max-width:280px;border-left:1px solid #334155;padding-left:1.5rem">
      <div class="callout-desc" style="font-size:.88rem">
        <strong>Compare the measured steps</strong><br>
        This table uses all successful observations and averages per-site summaries.
        The threshold count below is a separate diagnostic and does not filter this table.
        Timing differences alone do not establish their cause; compare the same workload,
        host configuration and sample counts before interpreting the result.
      </div>
    </div>
  </div>
</section>` : ""}

${hasCdpData && avgCdpBB !== null ? `
<section>
  <h2>Network round-trip vs actual page load — goto() breakdown
    <span class="info-icon">i<span class="tooltip">The <code style="font-size:.78rem;background:#0f172a;padding:.1rem .3rem;border-radius:.25rem">goto()</code> timer covers two things:<br><br><strong style="color:#22d3ee">Page load</strong> — DNS, TCP, TLS, TTFB, download, and DOM parse. Measured by the browser's own W3C Navigation Timing API, so it's identical regardless of runner.<br><br><strong style="color:#6366f1">CDP overhead</strong> — the DevTools Protocol round-trip: Playwright sends "navigate" and waits for "done". Over local IPC (self-hosted) this is near-zero. Over the network (Browserbase) it adds measurable latency.</span></span>
  </h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem">
    <div style="background:#0f2027;border:1px solid #22d3ee44;border-radius:.75rem;padding:1.5rem">
      <div style="font-size:.75rem;font-weight:600;color:#22d3ee;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.5rem">${selfHostedName} (${meta.selfHostedLabel}) — goto() median</div>
      <div style="display:flex;align-items:baseline;gap:.5rem;flex-wrap:wrap">
        <span style="font-size:1.9rem;font-weight:800;color:#e2e8f0">${fmtMs(avgPageLoadLocal ?? 0)}</span>
        <span style="color:#94a3b8;font-size:.9rem">page load</span>
        <span style="color:#64748b;font-size:1.1rem">+</span>
        <span style="font-size:1.9rem;font-weight:800;color:#6366f1">${fmtMs(avgCdpLocal ?? 0)}</span>
        <span style="color:#94a3b8;font-size:.9rem">local IPC</span>
      </div>
    </div>
    <div style="background:#130f27;border:1px solid #6366f1;border-radius:.75rem;padding:1.5rem">
      <div style="font-size:.75rem;font-weight:600;color:#818cf8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.5rem">Browserbase (successful observations with navigation timing) — mean of site medians</div>
      <div style="display:flex;align-items:baseline;gap:.5rem;flex-wrap:wrap">
        <span style="font-size:1.9rem;font-weight:800;color:#e2e8f0">${fmtMs(avgPageLoadBB ?? 0)}</span>
        <span style="color:#94a3b8;font-size:.9rem">page load</span>
        <span style="color:#64748b;font-size:1.1rem">+</span>
        <span style="font-size:1.9rem;font-weight:800;color:#94a3b8">${fmtMs(avgCdpBB)}</span>
        <span style="color:#94a3b8;font-size:.9rem">network round-trip</span>
      </div>
    </div>
  </div>
  ${meta.allBBCdpValues.length > 0 ? `
  <div class="card" style="margin-bottom:1.5rem">
    <div style="font-size:.82rem;color:#cbd5e1;margin-bottom:.25rem">
      <strong style="color:#22d3ee">Observations below threshold</strong> — ${meta.fastCount} of ${meta.totalBBCount} Browserbase sessions (${meta.fastPct}%)
    </div>
    <div style="font-size:.8rem;color:#64748b;margin-bottom:.75rem;line-height:1.55">
      The remaining ${100 - meta.fastPct}% are at or above the ${CDP_FAST_THRESHOLD}ms threshold. Counts include successful Browserbase observations with navigation timing; repeated run indexes count separately. This threshold does not establish the cause of a timing difference.
    </div>
    <div style="position:relative;height:150px"><canvas id="cdpHistogram"></canvas></div>
  </div>` : ""}
  <div class="card">
    <div class="tab-bar" id="cdp-tabs">
      ${cdpStats.map((cs, i) => `<button class="tab-btn${i === 0 ? " active" : ""}" onclick="switchCdp(${i})">${hostname(cs.site)}</button>`).join("")}
    </div>
    <div class="chart-wrap-sm" style="margin-top:1rem"><canvas id="cdpBreakdown"></canvas></div>
    <div class="legend" style="margin-top:.75rem">
      <span><span class="legend-dot" style="background:#22d3ee"></span>Page load (W3C nav sum)</span>
      <span><span class="legend-dot" style="background:#6366f1"></span>CDP overhead</span>
    </div>
  </div>
</section>` : ""}

<section>
  <h2>Step waterfall (median, seconds)</h2>
  <div class="card">
    <div class="tab-bar" id="waterfall-tabs">
      ${allWaterfallData.map((d, i) => `<button class="tab-btn${i === 0 ? " active" : ""}" onclick="switchWaterfall(${i})">${d.site}</button>`).join("")}
    </div>
    <div class="chart-wrap" style="margin-top:1rem"><canvas id="waterfall"></canvas></div>
  </div>
</section>

${hasNav && allNavData.length > 0 ? `
<section>
  <h2>Page load breakdown — W3C Navigation Timing (median)</h2>
  <div class="card">
    <p style="color:#94a3b8;font-size:.85rem;margin-bottom:1rem;">Measured inside the browser — independent of CDP transport. Values should be similar between competitors for the same site.</p>
    <div class="tab-bar" id="nav-tabs">
      ${allNavData.map((d, i) => `<button class="tab-btn${i === 0 ? " active" : ""}" onclick="switchNav(${i})">${d.site}</button>`).join("")}
    </div>
    <div class="chart-wrap-sm" style="margin-top:1rem"><canvas id="navBreakdown"></canvas></div>
    <div class="legend">
      ${NAV_KEYS.map((k) => `<span><span class="legend-dot" style="background:${NAV_COLORS[k]}"></span>${k === "domContentLoaded" ? "DCL event" : k.toUpperCase()}</span>`).join("")}
    </div>
  </div>
</section>` : ""}

${pageStats.some((s) => s.domNodes > 0) ? `
<section>
  <h2>Page complexity</h2>
  <div class="card">
    <p style="color:#94a3b8;font-size:.85rem;margin-bottom:1rem;">Averaged across all successful runs. Heavier pages generate more CDP messages during extract and act steps.</p>
    <table>
      <thead><tr><th>Site</th><th class="num">DOM nodes</th><th class="num">Subresources</th><th class="num">Transfer size</th></tr></thead>
      <tbody>
        ${pageStats.map((ps) => `
        <tr>
          <td>${hostname(ps.site)}</td>
          <td class="num">${ps.domNodes.toLocaleString()}</td>
          <td class="num">${ps.resources.toLocaleString()}</td>
          <td class="num">${fmtBytes(ps.transferBytes)}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>
</section>` : ""}

${costBreakdown ? `
<section>
  <h2>Cost analysis — Browserbase vs self-hosting</h2>
  <div class="tco-grid">
    <div class="card">
      <h3 style="font-size:.9rem;font-weight:600;color:#f87171;margin-bottom:1rem">Self-hosted <span class="pill pill-red">DIY</span></h3>
      <table>
        <tbody>
          <tr><td>Compute (Render Pro)</td><td class="num">$${costBreakdown.selfHosted.compute}/mo</td></tr>
          <tr><td>Ops engineering (${costBreakdown.selfHosted.opsHoursPerMonth}h/mo)</td><td class="num">$${costBreakdown.selfHosted.ops}/mo</td></tr>
          <tr><td>Feature build (amortized 12mo)</td><td class="num">$${costBreakdown.selfHosted.amortizedBuild}/mo</td></tr>
          <tr class="highlight"><td><strong>Total recurring</strong></td><td class="num"><strong>$${costBreakdown.selfHosted.total}/mo</strong></td></tr>
        </tbody>
      </table>
    </div>
    <div class="card">
      <h3 style="font-size:.9rem;font-weight:600;color:#4ade80;margin-bottom:1rem">Browserbase <span class="pill pill-green">Managed</span></h3>
      <table>
        <tbody>
          <tr><td>Compute (Render Starter, agent only)</td><td class="num">$${costBreakdown.browserbase.compute}/mo</td></tr>
          <tr><td>Browser-hours API (${process.env.SESSIONS_PER_DAY ?? "100"} sessions/day × ${process.env.AVG_SESSION_MINUTES ?? "5"}min)</td><td class="num">$${costBreakdown.browserbase.api.toFixed(2)}/mo</td></tr>
          <tr class="highlight"><td><strong>Total recurring</strong></td><td class="num"><strong>$${costBreakdown.browserbase.total.toFixed(2)}/mo</strong></td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <div class="card" style="margin-top:1.5rem">
    <table>
      <thead><tr><th>Breakeven threshold</th><th class="num">Sessions/day</th></tr></thead>
      <tbody>
        <tr class="breakeven-row"><td>Compute only (ignoring engineering)</td><td class="num">${costBreakdown.breakevenComputeOnly.toLocaleString()}</td></tr>
        <tr class="breakeven-row"><td>Full TCO (compute + ops)</td><td class="num">${costBreakdown.breakevenFullTco.toLocaleString()}</td></tr>
      </tbody>
    </table>
    <p class="section-note">For the compute-only crossover, this model compares fixed self-hosted compute with Browserbase agent compute plus variable API cost. Below the threshold the modeled Browserbase sum is lower; above it that sum is higher. Engineering assumptions are separate. These illustrative rates and capacity assumptions are not a current price quote.</p>
  </div>
</section>` : ""}

</main>
<script>
// Step color palette (matches server-side computation)
const STEP_COLORS = ${JSON.stringify(COLORS)};
const NAV_COLORS = ${JSON.stringify(NAV_COLORS)};

${meta.allBBCdpValues.length > 0 ? (() => {
  const fastVals = meta.allBBCdpValues.filter((v) => v < CDP_FAST_THRESHOLD);
  if (fastVals.length === 0) return "";
  const BIN_SIZE = 25;
  const lo = Math.floor(Math.min(...fastVals) / BIN_SIZE) * BIN_SIZE;
  const hi = Math.ceil(Math.max(...fastVals) / BIN_SIZE) * BIN_SIZE;
  const bins: number[] = [];
  for (let b = lo; b < hi; b += BIN_SIZE) bins.push(b);
  const counts = bins.map((b) => fastVals.filter((v) => v >= b && v < b + BIN_SIZE).length);
  const labels = bins.map((b) => (b % 100 === 0 ? (b / 1000).toFixed(2) + "s" : ""));
  return `new Chart(document.getElementById("cdpHistogram"), {
  type: "bar",
  data: { labels: ${JSON.stringify(labels)}, datasets: [{ data: ${JSON.stringify(counts)}, backgroundColor: "#22d3eecc", borderWidth: 0, categoryPercentage: 1.0, barPercentage: 0.9 }] },
  options: { responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: {
      title: (items) => { const b = ${lo} + items[0].dataIndex * ${BIN_SIZE}; return (b/1000).toFixed(3)+"s – "+((b+${BIN_SIZE})/1000).toFixed(3)+"s"; },
      label: (ctx) => ctx.parsed.y + " session" + (ctx.parsed.y === 1 ? "" : "s"),
    }}},
    scales: {
      x: { ticks: { color: "#94a3b8", font: { size: 11 }, maxRotation: 0 }, grid: { display: false } },
      y: { ticks: { color: "#94a3b8", font: { size: 11 } }, grid: { color: "#334155" }, title: { display: true, text: "sessions", color: "#64748b", font: { size: 11 } } },
    },
  },
});`;
})() : ""}

const allWaterfallData = ${JSON.stringify(allWaterfallData)};
const waterfallChart = new Chart(document.getElementById("waterfall"), {
  type: "bar",
  data: { labels: allWaterfallData[0].labels, datasets: allWaterfallData[0].datasets },
  options: {
    indexAxis: "y", responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#94a3b8" } },
      tooltip: { callbacks: { label: (ctx) => {
        const ds = ctx.dataset; const i = ctx.dataIndex;
        const med = (ctx.parsed.x/1000).toFixed(3)+"s";
        const q1 = ds.p25 ? (ds.p25[i]/1000).toFixed(3)+"s" : null;
        const q3 = ds.p75 ? (ds.p75[i]/1000).toFixed(3)+"s" : null;
        return q1 && q3 ? ds.label+": "+med+" (p25–p75: "+q1+"–"+q3+")" : ds.label+": "+med;
      }}},
    },
    scales: {
      x: { stacked: true, ticks: { color: "#94a3b8", callback: (v) => (v/1000).toFixed(1)+"s" }, grid: { color: "#334155" }, title: { display: true, text: "seconds (median)", color: "#64748b" } },
      y: { stacked: true, ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
    },
  },
});
function switchWaterfall(idx) {
  const d = allWaterfallData[idx];
  waterfallChart.data.labels = d.labels;
  waterfallChart.data.datasets = d.datasets;
  waterfallChart.update();
  document.querySelectorAll("#waterfall-tabs .tab-btn").forEach((b, i) => b.classList.toggle("active", i === idx));
}

${hasNav && allNavData.length > 0 ? `
const allNavData = ${JSON.stringify(allNavData)};
const navChart = new Chart(document.getElementById("navBreakdown"), {
  type: "bar",
  data: { labels: allNavData[0].labels, datasets: allNavData[0].datasets },
  options: {
    indexAxis: "y", responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ctx.dataset.label+": "+(ctx.parsed.x/1000).toFixed(3)+"s" }}},
    scales: {
      x: { stacked: true, ticks: { color: "#94a3b8", callback: (v) => (v/1000).toFixed(2)+"s" }, grid: { color: "#334155" }, title: { display: true, text: "seconds (median)", color: "#64748b" } },
      y: { stacked: true, ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
    },
  },
});
function switchNav(idx) {
  const d = allNavData[idx];
  navChart.data.labels = d.labels;
  navChart.data.datasets = d.datasets;
  navChart.update();
  document.querySelectorAll("#nav-tabs .tab-btn").forEach((b, i) => b.classList.toggle("active", i === idx));
}` : ""}

${hasCdpData && allCdpData.length > 0 ? `
const allCdpData = ${JSON.stringify(allCdpData)};
const cdpChart = new Chart(document.getElementById("cdpBreakdown"), {
  type: "bar",
  data: { labels: allCdpData[0].labels, datasets: allCdpData[0].datasets },
  options: {
    indexAxis: "y", responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: "#94a3b8" }}, tooltip: { callbacks: { label: (ctx) => ctx.dataset.label+": "+(ctx.parsed.x/1000).toFixed(3)+"s" }}},
    scales: {
      x: { stacked: true, ticks: { color: "#94a3b8", callback: (v) => (v/1000).toFixed(2)+"s" }, grid: { color: "#334155" }, title: { display: true, text: "seconds (median)", color: "#64748b" } },
      y: { stacked: true, ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
    },
  },
});
function switchCdp(idx) {
  const d = allCdpData[idx];
  cdpChart.data.labels = d.labels;
  cdpChart.data.datasets = d.datasets;
  cdpChart.update();
  document.querySelectorAll("#cdp-tabs .tab-btn").forEach((b, i) => b.classList.toggle("active", i === idx));
}` : ""}

function exportPdf() {
  const ts = Math.floor(Date.now() / 1000);
  const sites = ${JSON.stringify([...new Set(results.map((r) => r.site))].map(hostname))}.join("-");
  const original = document.title;
  document.title = "browserbase-benchmark-" + sites + "-" + ts;
  window.print();
  document.title = original;
}
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public API — used by server.ts
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function generateReportHtml(sourceResults: RunResult[]): string {
  if (sourceResults.length === 0) throw new Error("No result data. Run a benchmark before generating a report.");
  const scenarios = [...new Set(sourceResults.map((row) => row.scenario ?? "unspecified"))];
  if (scenarios.length > 1) {
    const reports = scenarios.map((scenario) => generateReportHtml(
      sourceResults.filter((row) => (row.scenario ?? "unspecified") === scenario),
    ));
    const serializedReports = JSON.stringify(reports).replace(/</g, "\\u003c");
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Browserbase benchmark scenarios</title>
<style>
body { margin:0; background:#0f172a; color:#e2e8f0; font:16px system-ui,sans-serif; }
header { padding:1rem; display:flex; gap:1rem; align-items:center; flex-wrap:wrap; }
select { font:inherit; padding:.4rem; max-width:100%; }
p { margin:0; color:#94a3b8; }
iframe { display:block; width:100%; height:85vh; border:0; }
</style></head><body>
<header><label for="scenario-select">Scenario</label>
<select id="scenario-select">${scenarios.map((scenario, i) => `<option value="${i}">${escapeHtml(scenario)}</option>`).join("")}</select>
<p>Each scenario has independent measurements. Use Export PDF inside the selected report.</p></header>
<iframe id="scenario-report" title="Selected scenario benchmark report" sandbox="allow-scripts allow-modals"></iframe>
<noscript>Enable JavaScript to choose a scenario and view its report.</noscript>
<script>
const scenarioReports = ${serializedReports};
const select = document.getElementById("scenario-select");
const frame = document.getElementById("scenario-report");
function showScenario() { frame.srcdoc = scenarioReports[Number(select.value)]; }
select.addEventListener("change", showScenario);
showScenario();
</script></body></html>`;
  }
  const { fastCount, totalBBCount, fastPct, allCdpValues } = getFastClusterInfo(sourceResults);
  const selfHostedHost =
    sourceResults.find((r) => r.competitor !== "browserbase" && r.metadata?.host)?.metadata?.host as string | undefined
    ?? "local-machine";

  const meta: ReportMeta = {
    fastCount,
    totalBBCount,
    fastPct,
    allBBCdpValues: allCdpValues,
    selfHostedLabel: hostLabel(selfHostedHost),
    competitorNames: [...new Set(sourceResults.map((r) => r.competitor))],
  };

  const stepNames = discoverStepNames(sourceResults);
  const stats = computeStats(sourceResults, stepNames);
  const navStats = computeNavStats(sourceResults);
  const cdpStats = computeCdpStats(sourceResults);
  const pageStats = computePageStats(sourceResults);

  return buildHtml(stats, navStats, cdpStats, pageStats, sourceResults, meta, stepNames);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main() {
  const useAll = process.argv.includes("--all");
  const fileArg =
    process.argv.find((a) => a.startsWith("--file="))?.slice("--file=".length) ??
    (process.argv.includes("--file") ? process.argv[process.argv.indexOf("--file") + 1] : undefined);

  const resultsDir = join(process.cwd(), "results");
  let files: string[];
  if (useAll) {
    files = readdirSync(resultsDir).filter((f) => f.endsWith(".json")).sort();
  } else if (fileArg) {
    files = [fileArg];
  } else {
    const all = readdirSync(resultsDir).filter((f) => f.endsWith(".json")).sort().reverse();
    if (all.length === 0) throw new Error("No results in ./results/. Run the benchmark first.");
    files = [all[0]];
  }

  const allResults: RunResult[] = files.flatMap((f) => {
    const path = f.includes("/") ? f : join(resultsDir, f);
    const data = JSON.parse(readFileSync(path, "utf-8")) as unknown[];
    return data.map(migrateResult);
  });

  const html = generateReportHtml(allResults);
  const outPath = resolve(process.cwd(), "report.html");
  writeFileSync(outPath, html);
  console.log(`Report written to: ${outPath}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
