// ---------------------------------------------------------------------------
// Pricing constants
// ---------------------------------------------------------------------------

// Render compute (primary deployment environment)
// https://render.com/pricing
const RENDER_PRO_MONTHLY = 85;       // Pro: 2 vCPU / 4 GB — required when Chromium runs co-located
const RENDER_STARTER_MONTHLY = 7;    // Starter: 0.5 CPU / 512 MB — sufficient for agent-only (Browserbase path)

// Browserbase browser compute
// $0.10/browser-hour. Future: millisecond-level billing (same rate, finer granularity).
export const BB_BROWSER_HOURLY = 0.10;

// Engineering rate used for all labour estimates
const ENGINEERING_RATE = 150; // USD/hr

// Ongoing self-hosting ops: Chromium version bumps, crash recovery, security patches,
// capacity planning. Conservative floor — does not include incident response.
const OPS_HOURS_PER_MONTH = 8;

// Features a self-hosted setup must build to reach Browserbase parity.
// Each entry is a [label, estimated engineering hours] pair.
// Hours are intentionally conservative (senior engineer, greenfield implementation).
export const FEATURE_BUILD_ITEMS: Array<{ name: string; hours: number }> = [
  { name: "Observability (structured logs, traces, metrics)",  hours: 30 },
  { name: "Session replay & live view",                        hours: 60 },
  { name: "Concurrency & request queue",                      hours: 30 },
  { name: "CAPTCHA solving integration",                      hours: 30 },
  { name: "Stealth mode & fingerprint evasion",               hours: 60 },
  { name: "Auto-scaling & capacity management",               hours: 40 },
  { name: "Incident runbooks & on-call playbooks",            hours: 20 },
];

const FEATURE_BUILD_AMORTIZATION_MONTHS = 12; // spread one-time cost over a year

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface CostParams {
  sessionsPerDay: number;
  avgSessionMinutes: number;
  opsHoursPerMonth?: number;
  /** Optional: actual measured browser milliseconds per session from benchmark results */
  avgBrowserMs?: number;
}

export interface FeatureItem {
  name: string;
  hours: number;
  cost: number;           // hours × ENGINEERING_RATE
}

export interface CostBreakdown {
  selfHosted: {
    opsHoursPerMonth: number;
    compute: number;           // Render Pro (browser + agent co-located)
    ops: number;               // ongoing ops engineering/month
    amortizedBuild: number;    // feature parity build cost ÷ 12
    total: number;             // recurring monthly TCO
    totalBuildCost: number;    // one-time upfront cost (not in total)
  };
  browserbase: {
    compute: number;           // Render Starter (agent only)
    api: number;               // browser-hours × $0.10
    total: number;
    /** Cost per individual session (browser-hours pricing) */
    costPerSession: number;
    /** If avgBrowserMs provided: cost per session at ms-level billing */
    costPerSessionMs: number | null;
  };
  features: FeatureItem[];
  /** Sessions/day where compute costs alone cross over (ignoring engineering) */
  breakevenComputeOnly: number;
  /** Sessions/day where full recurring TCO (compute + ops, no build amortization) crosses over */
  breakevenFullTco: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cost of a given number of browser-hours at the current rate */
export function bbCostForHours(hours: number): number {
  return hours * BB_BROWSER_HOURLY;
}

/** Cost at ms-level billing (same rate, billed by actual ms consumed) */
export function bbCostForMs(ms: number): number {
  return (ms / (1000 * 3600)) * BB_BROWSER_HOURLY;
}

function solveBreakeven(
  selfHostedFixed: number,
  bbFixed: number,
  avgSessionMinutes: number,
): number {
  // selfHostedFixed = bbFixed + sessions/month × (avgSessionMinutes / 60) × BB_BROWSER_HOURLY
  // → sessions/month = (selfHostedFixed - bbFixed) / (avgSessionMinutes / 60 × BB_BROWSER_HOURLY)
  const costPerSessionMonth = (avgSessionMinutes / 60) * BB_BROWSER_HOURLY;
  if (costPerSessionMonth <= 0) return 0;
  const sessionsPerMonth = (selfHostedFixed - bbFixed) / costPerSessionMonth;
  if (sessionsPerMonth <= 0) return 0;
  return Math.round(sessionsPerMonth / 30);
}

// ---------------------------------------------------------------------------
export function calculateCosts(params: CostParams): CostBreakdown {
  const { sessionsPerDay, avgSessionMinutes, avgBrowserMs, opsHoursPerMonth = OPS_HOURS_PER_MONTH } = params;
  if (!Number.isFinite(opsHoursPerMonth) || opsHoursPerMonth < 0) {
    throw new Error("Operations hours must be a finite nonnegative number");
  }
  const sessionsPerMonth = sessionsPerDay * 30;
  const browserHoursPerMonth = sessionsPerMonth * (avgSessionMinutes / 60);

  // ---- Self-hosted ----
  const computeSH = RENDER_PRO_MONTHLY;
  const opsCost = opsHoursPerMonth * ENGINEERING_RATE;

  const features: FeatureItem[] = FEATURE_BUILD_ITEMS.map((f) => ({
    name: f.name,
    hours: f.hours,
    cost: f.hours * ENGINEERING_RATE,
  }));
  const totalBuildCost = features.reduce((s, f) => s + f.cost, 0);
  const amortizedBuild = Math.round(totalBuildCost / FEATURE_BUILD_AMORTIZATION_MONTHS);

  const selfHostedTotal = computeSH + opsCost + amortizedBuild;

  // ---- Browserbase ----
  const computeBB = RENDER_STARTER_MONTHLY;
  const apiCost = bbCostForHours(browserHoursPerMonth);

  const costPerSession = bbCostForHours(avgSessionMinutes / 60);
  const costPerSessionMs = avgBrowserMs != null ? bbCostForMs(avgBrowserMs) : null;

  const browserbaseTotal = computeBB + apiCost;

  // ---- Breakeven ----
  // Compute-only: self-hosted compute vs BB compute + API
  const breakevenComputeOnly = solveBreakeven(computeSH, computeBB, avgSessionMinutes);
  // Full TCO: self-hosted (compute + ops) vs BB (compute + API) — build cost excluded
  //   since it's one-time; ops vs $0 is the recurring delta
  const breakevenFullTco = solveBreakeven(computeSH + opsCost, computeBB, avgSessionMinutes);

  return {
    selfHosted: {
      opsHoursPerMonth,
      compute: parseFloat(computeSH.toFixed(2)),
      ops: parseFloat(opsCost.toFixed(2)),
      amortizedBuild: parseFloat(amortizedBuild.toFixed(2)),
      total: parseFloat(selfHostedTotal.toFixed(2)),
      totalBuildCost: parseFloat(totalBuildCost.toFixed(2)),
    },
    browserbase: {
      compute: parseFloat(computeBB.toFixed(2)),
      api: parseFloat(apiCost.toFixed(2)),
      total: parseFloat(browserbaseTotal.toFixed(2)),
      costPerSession: parseFloat(costPerSession.toFixed(4)),
      costPerSessionMs: costPerSessionMs != null ? parseFloat(costPerSessionMs.toFixed(6)) : null,
    },
    features,
    breakevenComputeOnly,
    breakevenFullTco,
  };
}
