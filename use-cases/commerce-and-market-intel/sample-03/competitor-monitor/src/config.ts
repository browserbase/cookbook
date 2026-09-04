import dotenv from "dotenv";

// Load .env with `override` so the file is the source of truth for credentials. An
// empty/stale BROWSERBASE_* exported in your shell would otherwise SHADOW it —
// dotenv does not overwrite existing env vars by default — yielding a confusing
// "missing required env" even when .env is correct. Tunables passed inline
// (e.g. `MAX_RETRIES=4 npm run one`) still work: they aren't in .env, so override
// leaves them untouched.
dotenv.config({ override: true });

// ─────────────────────────────────────────────────────────────────────────────
// Domain
// ─────────────────────────────────────────────────────────────────────────────
export type Competitor = "shopee" | "temu" | "shein" | "aliexpress";
export type Country = "BR" | "MX" | "CL" | "CO" | "AR";

export const COMPETITORS: Competitor[] = [
  "shopee",
  "temu",
  "shein",
  "aliexpress",
];
export const COUNTRIES: Country[] = ["BR", "MX", "CL", "CO", "AR"];

export const COUNTRY_NAMES: Record<Country, string> = {
  BR: "Brazil",
  MX: "Mexico",
  CL: "Chile",
  CO: "Colombia",
  AR: "Argentina",
};

type Region = "us-east-1" | "us-west-2" | "eu-central-1" | "ap-southeast-1";

// ─────────────────────────────────────────────────────────────────────────────
// Config — env + tunables. Defaults are sane for a Scale-plan demo.
// ─────────────────────────────────────────────────────────────────────────────
export const CONFIG = {
  apiKey: process.env.BROWSERBASE_API_KEY ?? "",
  projectId: process.env.BROWSERBASE_PROJECT_ID ?? "",

  // The Browserbase SDK region enum currently has no South-America region. We pin
  // the session to us-east-1 (lowest LatAm latency of the available regions) and
  // let the residential proxy's `geolocation` supply the in-country exit IP — that
  // is what the target sites actually geo-check. If a sa-east-1 region appears,
  // set BB_REGION to use it.
  region: (process.env.BB_REGION as Region) ?? "us-east-1",

  // Scale ladder + the block-rate gate between stages.
  stageLadder: [1, 10, 100, 1000] as number[],
  successThreshold: Number(process.env.SUCCESS_THRESHOLD ?? 0.95),
  maxRetries: Number(process.env.MAX_RETRIES ?? 2),
  defaultWorkers: Number(process.env.WORKERS ?? 10),

  // Navigation / capture timing.
  navTimeoutMs: 90_000,
  captureTimeoutMs: 30_000, // a CAPTCHA solve can take up to ~30s
  settleMs: 4_000,
  inlineWaitMs: 20_000, // max wait for an inline <script> global to hydrate (only consumed on a miss; successes resolve as soon as the global appears)

  // Hard ceilings — measured 2026-06-11: a shein/BR cell wedged its CDP transport
  // and 10 sessions sat to the project's 15-min TTL with zero completions (the
  // page-level goto/evaluate timeouts can't fire when the transport itself stalls).
  // The attempt budget caps any single attempt (legit worst-case chain ≈ 230s,
  // measured straggler max 191s); the session timeout is the server-side backstop
  // so even an orphaned/wedged session can never bill past it.
  attemptBudgetMs: Number(process.env.ATTEMPT_BUDGET_MS ?? 240_000),
  sessionTimeoutSec: Number(process.env.SESSION_TIMEOUT_SEC ?? 300),

  // Cost model (USD). Proxy bandwidth dominates at scale — see README.
  computeUsdPerHour: 0.1, // Startup-plan browser-hour overage rate
  proxyUsdPerGb: 10, // realistic Scale residential rate (confirm your contract)

  // Used to extrapolate the 100k tier from the measured 1k run.
  planConcurrency: Number(process.env.BB_CONCURRENCY ?? 250), // Scale default
  extrapolateTo: 100_000,
};

/** Throw a clear error if the Browserbase credentials are missing (runtime only). */
export function requireEnv(): void {
  const missing: string[] = [];
  if (!CONFIG.apiKey) missing.push("BROWSERBASE_API_KEY");
  if (!CONFIG.projectId) missing.push("BROWSERBASE_PROJECT_ID");
  if (missing.length) {
    throw new Error(
      `Missing required env: ${missing.join(", ")}. ` +
        `Copy .env.example to .env and fill in your Browserbase credentials.`,
    );
  }
}
