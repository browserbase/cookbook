import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
// Sample Organization login-coverage diagnostic — Stagehand v3 + Browserbase
//
// For each of the four sites in sites.ts the harness:
//   1. Opens a Browserbase session under a chosen STEALTH PROFILE.
//   2. Navigates to the login page and lets any JS challenge settle.
//   3. IDENTIFIES the anti-bot in front of the page deterministically — by
//      matching cookies + script tags against the signatures in the internal
//      "Stealth x Support" matrix (Akamai abck/ak_bmsc, Cloudflare cf_clearance,
//      DataDome, PerimeterX, reCAPTCHA v2 vs v3, …) — and also asks the LLM to
//      describe the page. Deterministic detection wins; it tells us not just
//      "blocked" but *what* and *whether Browserbase can solve it*.
//   4. If real credentials are present in .env, attempts the full login and
//      re-classifies the post-submit page (where the customer's block fires).
//
// Why advanced stealth is the default: the matrix says Akamai (OpenTable, FedEx)
// is ❌ on Basic/Verified and ✅ only on ADVANCED stealth with a windows|mac
// fingerprint. The customer ran "verified" — not advanced stealth — which is why
// it unblocked nothing for them. The `verified` profile reproduces that failure;
// `stealth` (the default) is the configuration that should actually work.
//
// Run:
//   pnpm start                  # all sites, default "stealth" profile (adv stealth + os:mac)
//   pnpm start all verified     # reproduce the customer's failing setup
//   pnpm start opentable        # one site, default profile
//   pnpm start fedex baseline   # one site, no-stealth comparison
//
//   RETRIES=2 pnpm start opentable     # retry once with a fresh proxy if blocked
//   SOLVE_WAIT_MS=75000 pnpm start ... # how long to wait for a captcha solve post-submit
//
// Stagehand's default API mode routes act/extract through Browserbase's managed
// model gateway, so no LLM provider key is required.

import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Stagehand, browserbase, localBrowser } from '@browserbasehq/stagehand';
import { z } from 'zod';
import { SITES, type SiteSpec, type SiteId } from './sites';

// Keep the run on Browserbase's managed gateway: drop any local LLM provider
// keys so a stale shell var can't override the server-side key.
for (const k of [
  'GOOGLE_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
]) {
  delete process.env[k];
}
const MODEL = 'google/gemini-3-flash-preview';
const SOLVE_WAIT_MS = Math.max(15000, parseInt(process.env.SOLVE_WAIT_MS || '60000', 10) || 60000);
const MAX_ATTEMPTS = Math.max(1, parseInt(process.env.RETRIES || '1', 10) || 1);

// ── Stealth profiles ─────────────────────────────────────────────────────────
// baseline  → no stealth at all (the "normal tier" comparison)
// verified  → verified browser + proxies + captcha solving (the customer's setup
//             that FAILED; Akamai is ❌ here per the matrix)
// stealth   → advanced stealth + proxies + captcha solving + pinned OS fingerprint
//             (the matrix-recommended config; Akamai is ✅ here) — DEFAULT
export type ProfileName = 'baseline' | 'verified' | 'stealth';

interface Profile {
  verified: boolean;
  advancedStealth: boolean;
  proxies: boolean;
  solveCaptchas: boolean;
  useOsFingerprint: boolean; // apply the site's `os` pin
}

const PROFILES: Record<ProfileName, Profile> = {
  baseline: { verified: false, advancedStealth: false, proxies: false, solveCaptchas: false, useOsFingerprint: false },
  verified: { verified: true, advancedStealth: false, proxies: true, solveCaptchas: true, useOsFingerprint: true },
  stealth: { verified: false, advancedStealth: true, proxies: true, solveCaptchas: true, useOsFingerprint: true },
};
const DEFAULT_PROFILE: ProfileName = 'stealth';

// ── Anti-bot signatures (from the internal Stealth x Support matrix) ───────────
// Cookie-name → vendor + whether Browserbase can solve it. Deterministic and
// authoritative: an "abck" cookie IS Akamai, no LLM guessing required.
interface CookieSig {
  vendor: string;
  support: string;
  supported: boolean; // is this in the solvable set (worth a fresh-proxy retry)?
  test: (name: string) => boolean;
}
const COOKIE_SIGS: CookieSig[] = [
  { vendor: 'Akamai', support: 'Adv Stealth ✅ (windows/mac fp only) — Basic/Verified ❌', supported: true, test: (n) => /^ak_bmsc$/i.test(n) || /(^|_)abck$/i.test(n) || /^bm_(sv|sz|s|mi)$/i.test(n) },
  { vendor: 'Cloudflare', support: 'Adv Stealth ✅ (requires os ≠ windows)', supported: true, test: (n) => /^cf_clearance$/i.test(n) || /^__cf_bm$/i.test(n) },
  { vendor: 'DataDome', support: '⚠️ Sometimes (windows fp only)', supported: true, test: (n) => /^datadome$/i.test(n) },
  { vendor: 'PerimeterX', support: 'Adv Stealth ✅ (may need manual press-and-hold)', supported: true, test: (n) => /^_px[0-9a-z]*$/i.test(n) || /^pxuid$/i.test(n) },
  { vendor: 'AWS WAF', support: '✅', supported: true, test: (n) => /^aws-waf/i.test(n) },
  { vendor: 'hCaptcha', support: 'Adv Stealth ✅ (audio solve)', supported: true, test: (n) => /^h-captcha/i.test(n) || /^hmt_/i.test(n) },
  { vendor: 'Imperva/Incapsula', support: '⚠️ must register sitekey manually', supported: false, test: (n) => /^visid_incap/i.test(n) || /^incap_ses/i.test(n) || /^nlbi_/i.test(n) },
];

// Script/iframe host → vendor, for defenses that don't always drop a cookie.
const SCRIPT_SIGS: { vendor: string; support: string; supported: boolean; test: RegExp }[] = [
  { vendor: 'Cloudflare Turnstile', support: 'Adv Stealth ✅ (os ≠ windows)', supported: true, test: /challenges\.cloudflare\.com\/turnstile/i },
  { vendor: 'hCaptcha', support: 'Adv Stealth ✅ (audio solve)', supported: true, test: /\bhcaptcha\.com/i },
  { vendor: 'DataDome', support: '⚠️ Sometimes (windows fp only)', supported: true, test: /datadome/i },
  { vendor: 'PerimeterX', support: 'Adv Stealth ✅', supported: true, test: /perimeterx|px-cdn|px-cloud|client\.px|\/px\//i },
  { vendor: 'FunCaptcha', support: 'Adv Stealth ✅ (audio only)', supported: true, test: /funcaptcha|arkoselabs/i },
];

interface Detected {
  vendors: string[]; // human-readable, e.g. ["Akamai", "reCAPTCHA v3 (NOT supported)"]
  cookieNames: string[]; // matched cookie names only
  recaptcha: 'v2' | 'v3' | 'unknown' | null;
  supportNotes: string[]; // matrix support note per vendor
  retryWorthwhile: boolean; // blocked by a solvable defense → a fresh proxy may help
  hardUnsupported: boolean; // a known-unsolvable defense is present (e.g. reCAPTCHA v3)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── What the LLM observes (supplements the deterministic detection) ────────────
const Observation = z.object({
  loginFormVisible: z.boolean().describe('true if a real, usable login form (username/email + password inputs) is visible'),
  loginEntryVisible: z.boolean().describe('true if ANY login entry field is visible (email, username, or password), INCLUDING the first step of a multi-step / email-first login that only shows an email field before revealing the password'),
  captchaVisible: z.boolean().describe('true ONLY if an interactive captcha / "verify you are human" challenge the user must solve is visible. A passive invisible reCAPTCHA badge does NOT count.'),
  blockingMessage: z.string().nullable().describe('verbatim text of any access-denied / blocked / rate-limited / "unusual traffic" / error message, else null'),
  authenticatedControlsVisible: z.boolean().default(false).describe('Overridden by a deterministic visible-controls check; do not infer authentication from a missing form'),
  summary: z.string().describe('one short sentence describing what is currently on screen'),
});
type Observation = z.infer<typeof Observation>;

type Verdict =
  | 'reached_login'
  | 'blocked'
  | 'login_succeeded'
  | 'login_failed'
  | 'unknown'
  | 'error';

interface SiteResult {
  site: SiteId;
  label: string;
  url: string;
  profile: ProfileName;
  attempts: number;
  verdict: Verdict;
  loginAttempted: boolean;
  preSubmit: Observation | null;
  postSubmit: Observation | null;
  detected: Detected | null;
  sessionId: string | null;
  liveViewUrl: string | null;
  sessionReplayUrl: string | null;
  finalUrl: string | null;
  screenshots: string[];
  suspectedDefense: string;
  note: string;
  tookMs: number;
  error?: string;
}

function credsFor(site: SiteSpec): { username: string; password: string } | null {
  const u = process.env[site.usernameEnv]?.trim();
  const p = process.env[site.passwordEnv]?.trim();
  const real = (v?: string) => !!v && v.length > 0 && !v.startsWith('<');
  return real(u) && real(p) ? { username: u!, password: p! } : null;
}

function sessionParams(site: SiteSpec, p: Profile): Record<string, unknown> {
  const browserSettings: Record<string, unknown> = {};
  if (p.verified) browserSettings.verified = true;
  if (p.advancedStealth) browserSettings.advancedStealth = true;
  if (p.solveCaptchas) browserSettings.solveCaptchas = true;
  // Pin the OS fingerprint under any stealth profile (Akamai needs windows|mac;
  // Cloudflare-on-adv-stealth needs os ≠ windows; 'mac' satisfies both).
  if (p.useOsFingerprint && site.os) browserSettings.os = site.os;
  if (process.env.BROWSERBASE_CONTEXT_ID) {
    browserSettings.context = { id: process.env.BROWSERBASE_CONTEXT_ID, persist: true };
  }

  const params: Record<string, unknown> = { browserSettings };
  if (site.region) params.region = site.region;
  if (p.proxies) {
    params.proxies = site.proxyCountry
      ? [{ type: 'browserbase', geolocation: { country: site.proxyCountry } }]
      : true;
  }
  return params;
}

// Deterministically identify the anti-bot from cookies + script tags.
async function identifyAntibot(stagehand: Stagehand, page: any): Promise<Detected> {
  // Prefer the full cookie jar (includes HttpOnly cookies like Akamai's abck);
  // fall back to document.cookie if the context proxy doesn't expose cookies().
  let cookieNames: string[] = [];
  try {
    const jar = await (stagehand.browser.context as any).cookies();
    cookieNames = (jar || []).map((c: any) => String(c.name));
  } catch {
    /* fall through to the page probe below */
  }

  let urls: string[] = [];
  let recaptchaSrcs: string[] = [];
  let hasGrecaptcha = false;
  let hasV2Widget = false;
  let hasV3Render = false;
  try {
    const probe = (await page.evaluate(() => {
      const g: any = globalThis as any;
      const doc: any = g.document;
      const nodes: any[] = doc ? Array.from(doc.querySelectorAll('script[src], iframe[src]')) : [];
      const u: string[] = nodes.map((e: any) => e.src || '').filter(Boolean);
      const html: string = doc && doc.documentElement ? String(doc.documentElement.innerHTML).slice(0, 200000) : '';
      return {
        urls: u,
        recaptchaSrcs: u.filter((s: string) => /recaptcha|gstatic\.com\/recaptcha/i.test(s)),
        hasGrecaptcha: typeof g.grecaptcha !== 'undefined',
        // v2: a rendered checkbox/invisible widget (g-recaptcha element, explicit
        // render, or the api2/anchor iframe). v3: a render=<sitekey> loader or a
        // grecaptcha.execute() call (score-based, no widget).
        hasV2Widget: /class=["'][^"']*g-recaptcha/i.test(html) || /grecaptcha\.render\b/i.test(html) || /api2\/(anchor|bframe)/i.test(html) || u.some((s: string) => /api2\/(anchor|bframe)/i.test(s)),
        hasV3Render: /recaptcha\/api\.js\?[^"']*\brender=(?!explicit)[\w-]+/i.test(html) || /grecaptcha\.execute\s*\(/i.test(html) || u.some((s: string) => /recaptcha\/api\.js\?[^"']*\brender=(?!explicit)[\w-]+/i.test(s)),
        cookie: (doc && doc.cookie) || '',
      };
    })) as { urls: string[]; recaptchaSrcs: string[]; hasGrecaptcha: boolean; hasV2Widget: boolean; hasV3Render: boolean; cookie: string };
    urls = probe.urls || [];
    recaptchaSrcs = probe.recaptchaSrcs || [];
    hasGrecaptcha = probe.hasGrecaptcha;
    hasV2Widget = probe.hasV2Widget;
    hasV3Render = probe.hasV3Render;
    if (cookieNames.length === 0 && probe.cookie) {
      cookieNames = probe.cookie.split(';').map((s) => s.split('=')[0].trim()).filter(Boolean);
    }
  } catch {
    /* probe unavailable — rely on whatever cookies we have */
  }

  const vendors: string[] = [];
  const supportNotes: string[] = [];
  const matchedCookies: string[] = [];
  let retryWorthwhile = false;
  let hardUnsupported = false;

  for (const sig of COOKIE_SIGS) {
    const hits = cookieNames.filter((n) => sig.test(n));
    if (hits.length) {
      vendors.push(sig.vendor);
      supportNotes.push(`${sig.vendor}: ${sig.support}`);
      matchedCookies.push(...hits);
      retryWorthwhile = retryWorthwhile || sig.supported;
    }
  }
  for (const sig of SCRIPT_SIGS) {
    if (urls.some((u) => sig.test.test(u)) && !vendors.includes(sig.vendor)) {
      vendors.push(sig.vendor);
      supportNotes.push(`${sig.vendor}: ${sig.support}`);
      retryWorthwhile = retryWorthwhile || sig.supported;
    }
  }

  // reCAPTCHA version — the make-or-break detail. v2 is solvable; v3 (frictionless,
  // login-enforced, score-based) is NOT supported at all per the matrix.
  let recaptcha: Detected['recaptcha'] = null;
  if (recaptchaSrcs.length || hasGrecaptcha || hasV2Widget || hasV3Render) {
    const isV2 = hasV2Widget || recaptchaSrcs.some((s) => /api2|anchor|bframe|fallback/i.test(s));
    const isV3 = hasV3Render || recaptchaSrcs.some((s) => /[?&]render=(?!explicit)[\w-]+/i.test(s));
    // If a visible v2 widget is present, treat it as v2 (solvable) even if a v3
    // loader also exists — the v2 challenge is the one that gates submit.
    recaptcha = isV2 ? 'v2' : isV3 ? 'v3' : 'unknown';
    if (recaptcha === 'v3') {
      vendors.push('reCAPTCHA v3 (NOT supported — frictionless/score-based)');
      supportNotes.push('reCAPTCHA v3: ❌ not supported (no solver for frictionless v3)');
      hardUnsupported = true;
    } else if (recaptcha === 'v2') {
      vendors.push('reCAPTCHA v2');
      supportNotes.push('reCAPTCHA v2: ✅ adv stealth + proxies (retry for fresh proxy if no solve in ~60s)');
      retryWorthwhile = true;
    } else {
      vendors.push('reCAPTCHA (version unclear)');
      supportNotes.push('reCAPTCHA: confirm v2 (✅) vs v3 (❌) — check the api.js request for render= (v3) vs anchor (v2)');
    }
  }

  return {
    vendors,
    cookieNames: matchedCookies,
    recaptcha,
    supportNotes,
    retryWorthwhile: retryWorthwhile && !hardUnsupported,
    hardUnsupported,
  };
}

function authenticatedLoginControls() {
  const visible = (el: Element) => {
    if (!el.getClientRects().length) return false;
    for (let node: Element | null = el; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    return true;
  };
  const controls = [...document.querySelectorAll('a,button,[role="button"]')].filter(visible);
  const label = (el: Element) => (el.getAttribute('aria-label') || el.textContent || '').trim();
  const logout = controls.some(el => /^(log out|logout|sign out|signout)$/i.test(label(el)));
  const account = controls.some(el => /^(my account|account|my profile|profile|dashboard|account settings)$/i.test(label(el)));
  const entry = [...document.querySelectorAll<HTMLInputElement>('input')].some(el => visible(el) &&
    (['password', 'email'].includes(el.type) || /username|login/i.test(el.name + ' ' + el.id)));
  return logout && account && !entry;
}

async function observe(stagehand: Stagehand): Promise<Observation> {
  const data = (await stagehand.extract('Classify the current page for a bot-detection diagnostic. Identify visible login form/entry, interactive captcha and verbatim blocking message. A loading screen or missing form does not prove authentication.', Observation)).data;
  let authenticatedControlsVisible = false;
  try {
    const page = (await stagehand.browser.context.pages())[0];
    authenticatedControlsVisible = await page.evaluate(authenticatedLoginControls);
  } catch { /* Missing DOM evidence remains unverified. */ }
  return { ...data, authenticatedControlsVisible };
}

function authenticatedObservation(o: Observation) {
  return o.authenticatedControlsVisible === true && !o.loginFormVisible && !o.loginEntryVisible && !isWall(o);
}

function isWall(o: Observation | null): boolean {
  return !!o && (o.captchaVisible || !!(o.blockingMessage && o.blockingMessage.trim()));
}

function detectedSummary(d: Detected | null): string {
  if (!d || d.vendors.length === 0) return 'none detected';
  return d.vendors.join(', ');
}

async function snap(page: any, site: string, profile: string, phase: string): Promise<string> {
  const path = `output/${site}-${profile}-${phase}.png`;
  try {
    await page.screenshot({ path });
  } catch {
    /* API-mode Page proxy may not forward screenshot — skip silently */
  }
  return path;
}

function httpEvidenceUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

async function safeUrl(page: { url?: () => unknown }): Promise<string | null> {
  try { return httpEvidenceUrl(await page.url?.()); }
  catch { return null; }
}

async function sessionEvidence(id: unknown, apiKey: string | undefined) {
  const sessionId = typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id) ? id : null;
  const sessionReplayUrl = sessionId ? `https://www.browserbase.com/sessions/${encodeURIComponent(sessionId)}` : null;
  let liveViewUrl: string | null = null;
  if (sessionId && apiKey?.trim()) {
    try {
      const response = await fetch(`https://api.browserbase.com/v1/sessions/${encodeURIComponent(sessionId)}/debug`, {
        headers: { 'x-bb-api-key': apiKey }, signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) {
        const data: unknown = await response.json();
        if (data && typeof data === 'object' && 'debuggerFullscreenUrl' in data) liveViewUrl = httpEvidenceUrl(data.debuggerFullscreenUrl);
      }
    } catch { /* Keep the session replay link when live metadata is unavailable. */ }
  }
  return { sessionId, sessionReplayUrl, liveViewUrl };
}

function validateEvidenceFields(results: SiteResult[]) {
  const url = z.string().refine(value => httpEvidenceUrl(value) !== null).nullable();
  const evidence = z.object({ sessionId: z.string().regex(/^[a-zA-Z0-9_-]+$/).nullable(), finalUrl: url, liveViewUrl: url, sessionReplayUrl: url });
  for (const result of results) evidence.parse(result);
}

async function attemptOnce(site: SiteSpec, profileName: ProfileName, attempt: number): Promise<SiteResult> {
  const profile = PROFILES[profileName];
  const t0 = Date.now();
  const tag = attempt > 1 ? `a${attempt}` : '';
  const result: SiteResult = {
    site: site.id,
    label: site.label,
    url: site.url,
    profile: profileName,
    attempts: attempt,
    verdict: 'unknown',
    loginAttempted: false,
    preSubmit: null,
    postSubmit: null,
    detected: null,
    sessionId: null,
    liveViewUrl: null,
    sessionReplayUrl: null,
    finalUrl: null,
    screenshots: [],
    suspectedDefense: site.suspectedDefense,
    note: '',
    tookMs: 0,
  };

  const stagehand = await Stagehand.create(StagehandCreateOptionsSchema.parse({
  browser: await browserbase.launch({ apiKey: process.env.BROWSERBASE_API_KEY!, projectId: process.env.BROWSERBASE_PROJECT_ID, ...sessionParams(site, profile) as any }),
  model: MODEL
  }));

  try {

    Object.assign(result, await sessionEvidence(stagehand.browser.sessionId, process.env.BROWSERBASE_API_KEY));

    console.log(`\n[${site.label}] profile=${profileName}${attempt > 1 ? ` attempt=${attempt}` : ''} session=${result.sessionId ?? 'n/a'}`);
    if (result.liveViewUrl) console.log(`[${site.label}] live view: ${result.liveViewUrl}`);

    const page = (await stagehand.browser.context.pages())[0] as any;
    // Heavy SPAs (e.g. Aesthetic Record) can blow past the default load-state
    // wait. Don't let that hard-fail the probe — catch it and inspect whatever
    // rendered. A real block looks different (captcha/denied), not a nav timeout.
    try {
      await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch (navErr: any) {
      console.log(`[${site.label}] goto soft-timeout (${navErr?.message ?? navErr}) — continuing to inspect what loaded`);
    }
    await sleep(site.settleMs ?? 7000); // let the anti-bot sensor / SPA settle

    result.screenshots.push(await snap(page, site.id, profileName, `landing${tag}`));
    result.detected = await identifyAntibot(stagehand, page);
    result.preSubmit = await observe(stagehand);
    result.finalUrl = await safeUrl(page);

    const creds = credsFor(site);
    const o = result.preSubmit!;
    const hasForm = o.loginFormVisible || o.loginEntryVisible;
    // A captcha widget sitting ON a visible login form is a solvable gate, not a
    // hard block. Reserve "blocked" for an access-denied/interstitial message or a
    // captcha challenge with NO form behind it (a pure challenge page).
    const hardBlock = !!(o.blockingMessage && o.blockingMessage.trim()) || (o.captchaVisible && !hasForm);
    const captchaOnForm = o.captchaVisible && hasForm;
    const det = result.detected;
    const detNote = det && det.vendors.length ? ` Detected: ${det.vendors.join(', ')}.` : '';

    if (!creds) {
      if (hardBlock) {
        result.verdict = 'blocked';
        result.note = `Blocked before login (${o.summary}).${detNote} No credentials set — submit step not attempted.`;
      } else if (hasForm) {
        result.verdict = 'reached_login';
        const multiStep = !o.loginFormVisible && o.loginEntryVisible;
        const capNote = captchaOnForm
          ? ` A ${det?.recaptcha ? 'reCAPTCHA ' + det.recaptcha : 'captcha'} widget is on the form — it gates submit; solveCaptchas should clear a supported one once credentials are entered.`
          : '';
        result.note = `Reached the login ${multiStep ? 'entry (multi-step/email-first)' : 'form'} under \`${profileName}\`.${detNote}${capNote} Login attempt skipped — set ${site.usernameEnv}/${site.passwordEnv} in .env to test the submit step (where the customer's block fires).`;
      } else {
        result.verdict = 'unknown';
        result.note = `Could not confirm a login form: ${o.summary}${detNote}`;
      }
      if (det?.hardUnsupported) {
        result.note += ` ⚠️ A frictionless/unsupported defense (${det.vendors.join(', ')}) is present — likely fires at submit and is NOT solvable; flag for product.`;
      }
    } else {
      // Real credentials — attempt the login, then poll for a captcha solve.
      result.loginAttempted = true;
      for (const [instruction, variables] of [
        [`type %u% into ${site.usernameField}`, { u: creds.username }],
        [`type %p% into ${site.passwordField}`, { p: creds.password }],
        [`click ${site.submitButton}`, undefined],
      ] as const) {
        const action = await stagehand.act(instruction, variables ? { variables } : undefined);
        if (!action.data.success) throw new Error('Login action did not complete; authentication is unverified');
      }

      // Wait within the configured deadline for positive authenticated controls.
      // An absent form alone is not enough, including on loading-only pages.
      const deadline = Date.now() + SOLVE_WAIT_MS;
      let obs = await observe(stagehand);
      while (!authenticatedObservation(obs) && Date.now() < deadline) {
        await sleep(8000);
        obs = await observe(stagehand);
      }
      result.postSubmit = obs;
      result.detected = await identifyAntibot(stagehand, page);
      result.screenshots.push(await snap(page, site.id, profileName, `post-submit${tag}`));
      result.finalUrl = await safeUrl(page);

      if (isWall(obs)) {
        result.verdict = 'blocked';
        result.note = `Blocked at the submit step after ${Math.round(SOLVE_WAIT_MS / 1000)}s (${obs.summary}). Detected: ${detectedSummary(result.detected)}.`;
      } else if (authenticatedObservation(obs)) {
        result.verdict = 'login_succeeded';
        result.note = 'Login actions completed and visible logout plus account controls were observed without a login entry or wall. Account identity was not independently verified.';
      } else {
        result.verdict = 'unknown';
        result.note = 'Authentication was not confirmed before the deadline; a missing or remaining login form does not establish success or credential rejection.';
      }
    }
  } catch (err: any) {
    result.verdict = 'error';
    result.error = err?.message ?? String(err);
    result.note = `Harness error: ${result.error}`;
  } finally {
    result.tookMs = Date.now() - t0;
    try {
      await stagehand.close();
await stagehand.browser.close();
    } catch {
      /* ignore close errors */
    }
  }

  console.log(`[${site.label}] → ${result.verdict.toUpperCase()} (${(result.tookMs / 1000).toFixed(1)}s)${result.detected?.vendors.length ? ` · ${result.detected.vendors.join(', ')}` : ''}`);
  return result;
}

async function runSite(site: SiteSpec, profileName: ProfileName): Promise<SiteResult> {
  let last: SiteResult | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    last = await attemptOnce(site, profileName, attempt);
    if (last.verdict !== 'blocked') break; // only retry a block
    // Only worth a fresh proxy if the defense is one we can actually solve.
    if (attempt < MAX_ATTEMPTS && last.detected?.retryWorthwhile) {
      console.log(`[${site.label}] blocked by ${detectedSummary(last.detected)} — retrying with a fresh proxy (${attempt + 1}/${MAX_ATTEMPTS})`);
      continue;
    }
    break;
  }
  return last!;
}

const VERDICT_ICON: Record<Verdict, string> = {
  reached_login: '✅',
  login_succeeded: '✅',
  login_failed: '🟡',
  blocked: '⛔',
  unknown: '❔',
  error: '❌',
};

function renderScorecard(results: SiteResult[], profileName: ProfileName, ranAt: string): string {
  const rows = results
    .map(
      (r) =>
        `| ${r.label} | \`${r.profile}\` | ${VERDICT_ICON[r.verdict]} ${r.verdict} | ${r.loginAttempted ? 'yes' : 'no (no creds)'} | ${detectedSummary(r.detected)} | ${r.sessionId ?? '—'} |`,
    )
    .join('\n');

  const notes = results
    .map((r) => {
      const live = r.liveViewUrl ? `  \n  Live view: ${r.liveViewUrl}` : '';
      const replay = r.sessionReplayUrl ? `  \n  Replay: ${r.sessionReplayUrl}` : '';
      const suspect = `  \n  Suspected (pre-run): ${r.suspectedDefense}`;
      const support = r.detected?.supportNotes.length ? `  \n  Solver status: ${r.detected.supportNotes.join(' · ')}` : '';
      return `- **${r.label}** — ${r.note}${support}${suspect}${live}${replay}`;
    })
    .join('\n');

  return `# Sample Organization — login coverage scorecard

Profile: \`${profileName}\` · Run at: ${ranAt}

| Site | Profile | Verdict | Login tried | Anti-bot (detected) | Session |
|---|---|---|---|---|---|
${rows}

**Verdict key:** ✅ \`reached_login\` / \`login_succeeded\` — login reachability / observed account controls, respectively · 🟡 \`login_failed\` — legacy label, not inferred from a remaining form · ⛔ \`blocked\` — captcha/WAF wall (the reported failure) · ❔ \`unknown\` · ❌ \`error\`

Anti-bot detection is deterministic (cookie + script signatures from the internal Stealth x Support matrix), not an LLM guess.

## Notes
${notes}
`;
}

async function main() {
  if (!process.env.BROWSERBASE_API_KEY || !process.env.BROWSERBASE_PROJECT_ID) {
    console.error(
      'Missing BROWSERBASE_API_KEY / BROWSERBASE_PROJECT_ID.\nCopy .env.example to .env and fill them in (site credentials are optional for detection-only mode).',
    );
    process.exit(1);
  }

  let target: 'all' | SiteId = 'all';
  let profileName: ProfileName = DEFAULT_PROFILE;
  for (const a of process.argv.slice(2)) {
    if (a in PROFILES) profileName = a as ProfileName;
    else if (a === 'all') target = 'all';
    else if (SITES.some((s) => s.id === a)) target = a as SiteId;
    else {
      console.error(`Unknown argument: "${a}". Expected a site id (${SITES.map((s) => s.id).join(', ')}, all) or a profile (${Object.keys(PROFILES).join(', ')}).`);
      process.exit(1);
    }
  }

  const toRun = target === 'all' ? SITES : SITES.filter((s) => s.id === target);
  console.log(`\nLogin coverage login-coverage run · profile=${profileName} · sites=${toRun.map((s) => s.id).join(', ')}${MAX_ATTEMPTS > 1 ? ` · retries=${MAX_ATTEMPTS}` : ''}`);

  const results: SiteResult[] = [];
  for (const site of toRun) {
    results.push(await runSite(site, profileName));
  }

  const ranAt = new Date().toISOString();
  mkdirSync('output', { recursive: true });
  validateEvidenceFields(results);
  writeFileSync('output/results.json', JSON.stringify({ profile: profileName, ranAt, results }, null, 2));
  const scorecard = renderScorecard(results, profileName, ranAt);
  writeFileSync('output/scorecard.md', scorecard);
  console.log('\n' + scorecard);
  console.log('Full results: output/results.json · Screenshots: output/*.png');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { runSite, SITES };
export type { SiteResult };
