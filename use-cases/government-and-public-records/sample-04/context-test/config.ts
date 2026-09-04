// txcourts-context-test — site + stealth configuration
//
// One site: re:SearchTX (Texas court records), the Tyler Technologies portal a
// trial customer is trying to automate. The reported failure: login "completes"
// but the post-login OIDC callback runs through a WAF-protected URL that does not
// reliably hand the session into the authenticated app — so the agent lands back
// on the PUBLIC /ui/Home page. Reaching /ui/Home is the FAILURE here, not success
// (unauthenticated /ui/Home looks almost identical to the signed-in landing).
//
// The plan this harness tests: drive ONE clean login into the authenticated
// program in a Browserbase session (a human at the wheel in Live View), capture
// that session as a Browserbase Context, and reuse the contextId on every future
// run so we skip the OIDC redirect / WAF callback entirely. The make-or-break
// question — and the thing this harness exists to answer — is whether the
// captured Context actually re-authenticates from a FRESH session, since gov /
// Tyler-Odyssey sites sometimes bind a session to its IP or TLS fingerprint.

export const SITE = {
  label: "re:SearchTX (Texas court records)",
  // The public SPA landing. Unauthenticated AND authenticated users can end up
  // here, which is exactly why "we're on /ui/Home" must never be read as success.
  homeUrl: "https://research.txcourts.gov/CourtRecordsSearch/ui/Home",
  // Login is "Sign in with eFileTexas Account" (Tyler Identity / OIDC) — observed
  // on the landing page. Documented for the SE; the harness does not assume it —
  // a human completes login in Live View during `setup`.
  loginHostHint: "eFileTexas Account (Tyler Identity / OIDC)",
} as const;

// ── Stealth profiles ───────────────────────────────────────────────────────
// Mirrors the internal browser configuration test matrix:
//   baseline → no stealth (control)
//   verified → verified browser + proxies + captcha solving — the customer's
//              setup that FAILED to unblock anything
//   stealth  → advanced stealth + proxies + captcha solving + pinned macOS
//              fingerprint — the matrix-recommended config (DEFAULT)
// The macOS fingerprint (browserSettings.os = "mac") is the pin the customer
// case flagged: Akamai/AWS-WAF want a windows|mac fingerprint, Cloudflare-on-adv
// -stealth wants os ≠ windows, and "mac" satisfies both.
export type ProfileName = "baseline" | "verified" | "stealth";

export interface Profile {
  verified: boolean;
  advancedStealth: boolean;
  proxies: boolean;
  solveCaptchas: boolean;
  useOsFingerprint: boolean;
}

export const PROFILES: Record<ProfileName, Profile> = {
  baseline: {
    verified: false,
    advancedStealth: false,
    proxies: false,
    solveCaptchas: false,
    useOsFingerprint: false,
  },
  verified: {
    verified: true,
    advancedStealth: false,
    proxies: true,
    solveCaptchas: true,
    useOsFingerprint: true,
  },
  stealth: {
    verified: false,
    advancedStealth: true,
    proxies: true,
    solveCaptchas: true,
    useOsFingerprint: true,
  },
};

export const DEFAULT_PROFILE: ProfileName = "stealth";

// ── Tunables (all overridable via .env) ──────────────────────────────────────
export const REGION = process.env.BB_REGION || "us-east-1";
export const PROXY_COUNTRY = process.env.PROXY_COUNTRY || "US";
export const PROXY_STATE = process.env.PROXY_STATE || "TX"; // customer wants a Texas exit IP; blank to disable
export const OS_FINGERPRINT = (process.env.OS_FINGERPRINT || "mac") as
  "windows" | "mac" | "linux";

// Stagehand routes act/extract through Browserbase's managed model gateway, so no
// LLM provider key is needed. Any gateway-supported id works; swap to a Claude
// model (e.g. anthropic/claude-sonnet-4-6) for a Claude-driven run.
export const MODEL = process.env.MODEL || "google/gemini-3-flash-preview";

export const SETTLE_MS = parseInt(process.env.SETTLE_MS || "8000", 10);
export const NAV_TIMEOUT_MS = parseInt(
  process.env.NAV_TIMEOUT_MS || "60000",
  10,
);
// Interactive `setup` keeps the session alive this long for a human to log in.
export const SETUP_SESSION_TIMEOUT_S = parseInt(
  process.env.SETUP_SESSION_TIMEOUT_S || "1800",
  10,
);

// Build the browserbaseSessionCreateParams for a given profile.
//   contextId  — attach a persistent Context (cookies + localStorage), or omit.
//   persist    — true: save session changes back into the Context on close.
export function sessionParams(opts: {
  profile: Profile;
  contextId?: string | null;
  persist?: boolean;
}): Record<string, unknown> {
  const { profile, contextId, persist = false } = opts;
  const browserSettings: Record<string, unknown> = {};
  if (profile.verified) browserSettings.verified = true;
  if (profile.advancedStealth) browserSettings.advancedStealth = true;
  if (profile.solveCaptchas) browserSettings.solveCaptchas = true;
  if (profile.useOsFingerprint) browserSettings.os = OS_FINGERPRINT;
  if (contextId) browserSettings.context = { id: contextId, persist };

  const params: Record<string, unknown> = { browserSettings, region: REGION };
  if (profile.proxies) {
    const geolocation: Record<string, string> = { country: PROXY_COUNTRY };
    if (PROXY_STATE) geolocation.state = PROXY_STATE;
    params.proxies = [{ type: "browserbase", geolocation }];
  }
  return params;
}

// Cookie names that suggest a real authenticated session was restored. Diagnostic
// only — presence is a strong hint, absence is not proof either way.
export function looksLikeAuthCookie(name: string): boolean {
  return /(^|[._-])(auth|session|sess|token|idsrv|oidc|\.aspnet|tyler|odyssey|saml|jwt|access)/i.test(
    name,
  );
}
