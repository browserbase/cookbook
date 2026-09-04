import Browserbase from "@browserbasehq/sdk";
import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
// txcourts-context-test — prove (or disprove) Browserbase Context reuse for re:SearchTX
//
// Four commands, each its own Browserbase session:
//
//   probe   credential-free. Open the stealth profile, hit the public /ui/Home,
//           detect any WAF/anti-bot in front of it, and classify the page. Proves
//           the stealth config beats the WAF that 403s a normal client, and
//           exercises the /ui/Home-trap classifier. Run this first.
//
//   setup   create (or reuse) a Context, open a session with persist:true, hand
//           you a Live View URL, and wait while YOU log in all the way into the
//           authenticated program. On Enter it verifies you actually landed
//           inside (not bounced to public /ui/Home), then closes — which saves
//           the auth state into the Context. Prints the contextId to reuse.
//
//   verify  THE gating test. Fresh session, SAME contextId, persist:false, no
//           login. Navigate in and classify: did the captured Context
//           re-authenticate from a brand-new session, or did it bounce to
//           /ui/Home? This is the question everything hinges on (gov sites can
//           bind a session to its IP / TLS fingerprint).
//
//   search  fresh session + contextId, run a court-records search and extract
//           structured results — but only after confirming we're authenticated,
//           so we never report the public bounce as a "result".
//
// Stagehand's default API mode routes act/extract through Browserbase's managed
// model gateway, so no LLM provider key is required.

import "dotenv/config";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { mkdirSync, writeFileSync } from "node:fs";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";
import {
  SITE,
  PROFILES,
  DEFAULT_PROFILE,
  MODEL,
  SETTLE_MS,
  NAV_TIMEOUT_MS,
  SETUP_SESSION_TIMEOUT_S,
  REGION,
  PROXY_COUNTRY,
  PROXY_STATE,
  OS_FINGERPRINT,
  sessionParams,
  looksLikeAuthCookie,
  type ProfileName,
} from "./config";

// Keep act/extract on Browserbase's managed gateway: drop any local provider key
// so a stale shell var can't override the server-side key.
for (const k of [
  "GOOGLE_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
]) {
  delete process.env[k];
}

const API_KEY = process.env.BROWSERBASE_API_KEY || "";
const PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID || "";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Anti-bot / WAF signatures (from the internal "Stealth x Support" matrix) ──
// Cookie name → vendor + whether Browserbase's stealth can clear it. Deterministic
// and authoritative: an "abck" cookie IS Akamai, an "aws-waf-token" IS AWS WAF.
interface CookieSig {
  vendor: string;
  support: string;
  test: (n: string) => boolean;
}
const COOKIE_SIGS: CookieSig[] = [
  {
    vendor: "Akamai",
    support: "Adv Stealth ✅ (windows/mac fp) — Basic/Verified ❌",
    test: (n) =>
      /^ak_bmsc$/i.test(n) ||
      /(^|_)abck$/i.test(n) ||
      /^bm_(sv|sz|s|mi)$/i.test(n),
  },
  { vendor: "AWS WAF", support: "✅", test: (n) => /^aws-waf/i.test(n) },
  {
    vendor: "Cloudflare",
    support: "Adv Stealth ✅ (os ≠ windows)",
    test: (n) => /^cf_clearance$/i.test(n) || /^__cf_bm$/i.test(n),
  },
  {
    vendor: "DataDome",
    support: "⚠️ Sometimes (windows fp only)",
    test: (n) => /^datadome$/i.test(n),
  },
  {
    vendor: "PerimeterX",
    support: "Adv Stealth ✅ (may need press-and-hold)",
    test: (n) => /^_px[0-9a-z]*$/i.test(n) || /^pxuid$/i.test(n),
  },
  {
    vendor: "Imperva/Incapsula",
    support: "⚠️ must register sitekey manually",
    test: (n) =>
      /^visid_incap/i.test(n) || /^incap_ses/i.test(n) || /^nlbi_/i.test(n),
  },
];
const SCRIPT_SIGS: { vendor: string; test: RegExp }[] = [
  {
    vendor: "Cloudflare Turnstile",
    test: /challenges\.cloudflare\.com\/turnstile/i,
  },
  { vendor: "hCaptcha", test: /\bhcaptcha\.com/i },
  { vendor: "DataDome", test: /datadome/i },
  {
    vendor: "PerimeterX",
    test: /perimeterx|px-cdn|px-cloud|client\.px|\/px\//i,
  },
  { vendor: "reCAPTCHA", test: /recaptcha|gstatic\.com\/recaptcha/i },
  { vendor: "AWS WAF", test: /aws-waf|awswaf|token\.awswaf/i },
];

interface Cookie {
  name: string;
  value: string;
}
interface Detected {
  vendors: string[];
  cookieNames: string[];
  // Auth-ish cookies as "name=value" — re:SearchTX exposes `sess_loggedIn`, whose
  // value is the deterministic signal that corroborates the LLM's signed-in read.
  authCookies: string[];
  supportNotes: string[];
}

async function captureCookies(stagehand: Stagehand): Promise<Cookie[]> {
  try {
    const jar = await (stagehand.browser.context as any).cookies();
    return (jar || []).map((c: any) => ({
      name: String(c.name),
      value: String(c.value ?? ""),
    }));
  } catch {
    return [];
  }
}

async function identifyWaf(
  stagehand: Stagehand,
  page: any,
  cookies: Cookie[],
): Promise<Detected> {
  const cookieNames = cookies.map((c) => c.name);
  let urls: string[] = [];
  try {
    urls = (await page.evaluate(() => {
      const doc: any = (globalThis as any).document;
      const nodes: any[] = doc
        ? Array.from(doc.querySelectorAll("script[src], iframe[src]"))
        : [];
      return nodes.map((e: any) => e.src || "").filter(Boolean);
    })) as string[];
  } catch {
    /* probe unavailable */
  }

  const vendors: string[] = [];
  const supportNotes: string[] = [];
  const matchedCookies: string[] = [];
  for (const sig of COOKIE_SIGS) {
    const hits = cookieNames.filter((n) => sig.test(n));
    if (hits.length) {
      vendors.push(sig.vendor);
      supportNotes.push(`${sig.vendor}: ${sig.support}`);
      matchedCookies.push(...hits);
    }
  }
  for (const sig of SCRIPT_SIGS) {
    if (urls.some((u) => sig.test.test(u)) && !vendors.includes(sig.vendor)) {
      vendors.push(sig.vendor);
    }
  }
  return {
    vendors,
    cookieNames: matchedCookies,
    authCookies: cookies
      .filter((c) => looksLikeAuthCookie(c.name))
      .map((c) => `${c.name}=${c.value}`),
    supportNotes,
  };
}

// ── What the LLM observes — written specifically around the /ui/Home trap ─────
const PageState = z.object({
  signInVisible: z
    .boolean()
    .describe(
      'true if a Sign In, Log In, Register, or "Sign in to your account" link/button is visible anywhere — this means we are NOT signed in',
    ),
  signedInIndicator: z
    .boolean()
    .describe(
      'true ONLY if a signed-in indicator is visible: a logged-in user/account name, an account/profile menu, a Sign Out / Log Out option, "My Account", or authenticated-only tools like saved searches, folders, or case alerts. Being on a normal page or seeing a search box does NOT count.',
    ),
  searchUiVisible: z
    .boolean()
    .describe(
      "true if a court-records search box or form (search by case number, party name, attorney, etc.) is visible and usable on this page",
    ),
  captchaVisible: z
    .boolean()
    .describe(
      'true ONLY if an interactive captcha / "verify you are human" challenge the user must solve is visible (a passive invisible badge does NOT count)',
    ),
  blockingMessage: z
    .string()
    .nullable()
    .describe(
      'verbatim text of any access-denied / forbidden / blocked / rate-limited / "unusual traffic" / error message, else null',
    ),
  summary: z
    .string()
    .describe("one short sentence describing what is currently on screen"),
});
type PageState = z.infer<typeof PageState>;

const TRANSIENT_RE =
  /(GatewayInternalServerError|temporarily unavailable|overloaded|\b5\d\d\b|ECONNRESET|ETIMEDOUT|fetch failed|socket hang up)/i;

// Retry model-gateway calls on transient errors (e.g. a 500 "Service temporarily
// unavailable") so a blip mid-run doesn't kill a recording. Non-transient errors
// and a final failure propagate unchanged.
async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const msg = e?.message ?? String(e);
      if (!TRANSIENT_RE.test(msg) || i === attempts) throw e;
      const backoffMs = 2000 * i;
      console.log(
        `[retry] ${label}: transient error (${msg.slice(0, 80)}) — retrying in ${backoffMs}ms (${i}/${attempts - 1})`,
      );
      await sleep(backoffMs);
    }
  }
  throw lastErr;
}

async function observe(stagehand: Stagehand): Promise<PageState> {
  return (await withRetry("observe", () =>
    stagehand
      .extract(
        [
          "Classify the current page for an authentication diagnostic on a court-records portal.",
          "Critically: this portal shows the SAME public home page to signed-out users and",
          "sometimes after a failed login, so do NOT infer that we are signed in just because",
          "a page loaded or a search box is present. Only report signedInIndicator=true when",
          "there is an explicit signed-in signal (account name, account menu, Sign Out, My Account,",
          "saved searches/folders/alerts). If a Sign In / Log In / Register control is visible,",
          "set signInVisible=true. Also report whether a usable court-records search form is visible,",
          "whether an interactive captcha is shown, and the verbatim text of any blocking/error message.",
        ].join(" "),
        PageState,
      )
      .then((result) => result.data),
  )) as PageState;
}

type AuthState =
  "authenticated" | "public_home" | "login_page" | "blocked" | "unknown";

interface AuthSignals {
  sessLoggedIn: boolean | null; // re:Search's sess_loggedIn cookie value (null = absent)
  hasJwt: boolean; // a populated RSCH_JWT / idsrv session cookie is present
}

// Deterministic auth read from cookies. re:SearchTX flips `sess_loggedIn` true/false
// and drops a populated RSCH_JWT + Tyler IdentityServer (idsrv*) session on login —
// ground truth that does NOT depend on whether the SPA has painted its chrome yet.
function readAuthSignals(cookies: Cookie[]): AuthSignals {
  const sess = cookies.find((c) => /^sess_loggedIn$/i.test(c.name));
  const sessLoggedIn = sess ? /^true$/i.test(sess.value.trim()) : null;
  const hasJwt = cookies.some(
    (c) =>
      /(jwt|^idsrv$|idsrvauth)/i.test(c.name) && c.value.trim().length > 20,
  );
  return { sessLoggedIn, hasJwt };
}

function classifyAuthState(
  url: string | null,
  o: PageState,
  signals: AuthSignals,
): { state: AuthState; reason: string } {
  const onHome = !!url && /\/CourtRecordsSearch\/ui\/Home/i.test(url);
  const onLoginHost =
    !!url && /(login|identity|auth|idp|sso|tylertech)/i.test(url) && !onHome;

  // A hard block wins over everything — a WAF/deny page can still carry stale auth cookies.
  if (o.blockingMessage && o.blockingMessage.trim())
    return {
      state: "blocked",
      reason: `blocking message: "${o.blockingMessage.trim()}"`,
    };
  if (o.captchaVisible && !o.searchUiVisible)
    return {
      state: "blocked",
      reason: "interactive captcha with no usable page behind it",
    };

  // DETERMINISTIC auth signal beats the LLM's UI read: the re:Search SPA frequently
  // hasn't rendered the signed-in chrome at snapshot time, but the cookie is truth.
  if (signals.sessLoggedIn === true)
    return {
      state: "authenticated",
      reason: `sess_loggedIn=true${signals.hasJwt ? " + restored RSCH_JWT / Tyler idsrv session" : ""} — deterministic, regardless of whether the SPA chrome had painted`,
    };

  // LLM corroboration, used when the deterministic cookie is absent/unknown.
  if (o.signedInIndicator && !o.signInVisible)
    return {
      state: "authenticated",
      reason: "explicit signed-in indicator present, no Sign In control",
    };

  // Explicit NOT-signed-in cookie — the /ui/Home bounce is deterministically sess_loggedIn=false.
  if (signals.sessLoggedIn === false)
    return {
      state: onHome || !onLoginHost ? "public_home" : "login_page",
      reason:
        "sess_loggedIn=false — deterministically not signed in (the bounce that looks like success)",
    };

  if (onLoginHost && o.signInVisible)
    return {
      state: "login_page",
      reason: "on an identity/login host with a Sign In control",
    };
  if (o.signInVisible && !o.signedInIndicator) {
    return {
      state: onHome ? "public_home" : "login_page",
      reason: onHome
        ? "on /ui/Home with a Sign In control and no signed-in indicator — the unauthenticated bounce that looks like success"
        : "Sign In control visible, no signed-in indicator",
    };
  }
  if (o.signedInIndicator && o.signInVisible)
    return {
      state: "unknown",
      reason:
        "conflicting signals: both a signed-in indicator AND a Sign In control are visible",
    };
  return { state: "unknown", reason: `could not classify (${o.summary})` };
}

// ── Browserbase Context helpers (raw API — no SDK dependency needed) ──────────
async function createContext(): Promise<string> {
  const res = await fetch("https://api.browserbase.com/v1/contexts", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-bb-api-key": API_KEY },
    body: JSON.stringify({ projectId: PROJECT_ID }),
  });
  if (!res.ok)
    throw new Error(
      `Context create failed: HTTP ${res.status} ${await res.text()}`,
    );
  return ((await res.json()) as { id: string }).id;
}

async function resolveContextId(create: boolean): Promise<string | null> {
  const existing = process.env.BROWSERBASE_CONTEXT_ID?.trim();
  if (existing) {
    console.log(`📦 Reusing Context: ${existing}`);
    return existing;
  }
  if (!create) return null;
  console.log("📦 Creating a new Browserbase Context...");
  const id = await createContext();
  console.log(`✅ Context created: ${id}`);
  console.log(`   Save it:  BROWSERBASE_CONTEXT_ID=${id}\n`);
  return id;
}

interface Session {
  stagehand: Stagehand;
  page: any;
  sessionId: string | null;
  liveViewUrl: string | null;
}

async function openSession(opts: {
  profileName: ProfileName;
  contextId?: string | null;
  persist?: boolean;
  sessionTimeoutS?: number;
  label: string;
}): Promise<Session> {
  const profile = PROFILES[opts.profileName];
  const params = sessionParams({
    profile,
    contextId: opts.contextId,
    persist: opts.persist,
  }) as any;
  if (opts.sessionTimeoutS) params.timeout = opts.sessionTimeoutS;
  params.userMetadata = {
    harness: "txcourts-context-test",
    phase: opts.label,
    profile: opts.profileName,
  };

  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await browserbase.launch({
        apiKey: process.env.BROWSERBASE_API_KEY!,
        ...{ projectId: PROJECT_ID, ...params },
      }),
      model: MODEL,
    }),
  );

  const sessionId = stagehand.browser.sessionId ?? null;
  const liveViewUrl = (
    await new Browserbase({
      apiKey: process.env.BROWSERBASE_API_KEY,
    }).sessions.debug(stagehand.browser.sessionId!)
  ).debuggerFullscreenUrl;
  const page = (await stagehand.browser.context.pages())[0];

  console.log(
    `\n[${opts.label}] profile=${opts.profileName} session=${sessionId ?? "n/a"}`,
  );
  if (liveViewUrl) console.log(`[${opts.label}] live view: ${liveViewUrl}`);
  return { stagehand, page, sessionId, liveViewUrl };
}

async function gotoSettleClassify(
  s: Session,
  url: string,
): Promise<{
  obs: PageState;
  detected: Detected;
  auth: ReturnType<typeof classifyAuthState>;
  finalUrl: string | null;
}> {
  try {
    await s.page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });
  } catch (e: any) {
    console.log(
      `[nav] soft-timeout (${e?.message ?? e}) — inspecting whatever rendered`,
    );
  }
  await sleep(SETTLE_MS);
  const cookies = await captureCookies(s.stagehand);
  const detected = await identifyWaf(s.stagehand, s.page, cookies);
  const obs = await observe(s.stagehand);
  const finalUrl = (() => {
    try {
      return s.page.url();
    } catch {
      return null;
    }
  })();
  const auth = classifyAuthState(finalUrl, obs, readAuthSignals(cookies));
  return { obs, detected, auth, finalUrl };
}

async function snap(page: any, name: string): Promise<string> {
  const path = `output/${name}.png`;
  try {
    await page.screenshot({ path });
  } catch {
    /* API-mode proxy may not forward screenshot */
  }
  return path;
}

function writeResult(name: string, data: unknown): void {
  mkdirSync("output", { recursive: true });
  writeFileSync(`output/${name}.json`, JSON.stringify(data, null, 2));
  console.log(`\n📝 Wrote output/${name}.json`);
}

function printDetect(d: Detected): void {
  console.log(
    `   WAF/anti-bot:  ${d.vendors.length ? d.vendors.join(", ") : "none detected"}`,
  );
  if (d.supportNotes.length)
    console.log(`   Solver status: ${d.supportNotes.join(" · ")}`);
  if (d.authCookies.length)
    console.log(`   Auth-ish cookies: ${d.authCookies.join(", ")}`);
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function cmdProbe(profileName: ProfileName): Promise<void> {
  console.log(
    `\n=== PROBE (credential-free reachability + WAF + page classification) ===`,
  );
  console.log(
    `Profile ${profileName} · region ${REGION} · proxy ${PROXY_COUNTRY}${PROXY_STATE ? "/" + PROXY_STATE : ""} · os ${OS_FINGERPRINT} · model ${MODEL}`,
  );
  const s = await openSession({ profileName, label: "probe" });
  try {
    const { obs, detected, auth, finalUrl } = await gotoSettleClassify(
      s,
      SITE.homeUrl,
    );
    await snap(s.page, `probe-${profileName}`);
    console.log(`\n[probe] final URL: ${finalUrl}`);
    console.log(`[probe] page: ${obs.summary}`);
    printDetect(detected);
    console.log(
      `[probe] auth state: ${auth.state.toUpperCase()} — ${auth.reason}`,
    );
    console.log(
      `[probe] search UI on landing (guest search?): ${obs.searchUiVisible ? "yes" : "no"}`,
    );
    writeResult(`probe-${profileName}`, {
      ranAt: new Date().toISOString(),
      profile: profileName,
      finalUrl,
      obs,
      detected,
      auth,
      sessionId: s.sessionId,
      liveViewUrl: s.liveViewUrl,
    });
    console.log(
      auth.state === "blocked"
        ? `\n⛔ Blocked under \`${profileName}\`. ${detected.vendors.length ? "Detected " + detected.vendors.join(", ") + "." : ""} Try the \`stealth\` profile, or RETRY with a fresh proxy.`
        : `\n✅ Reached the site under \`${profileName}\` (WebFetch gets a 403; the stealth browser does not). Page classified as ${auth.state}.`,
    );
  } finally {
    await s.stagehand.close().catch(() => {});
  }
}

async function cmdSetup(profileName: ProfileName): Promise<void> {
  console.log(`\n=== SETUP (interactive login → capture Context) ===`);
  const contextId = await resolveContextId(true);
  const s = await openSession({
    profileName,
    contextId,
    persist: true, // save the logged-in state into the Context on close
    sessionTimeoutS: SETUP_SESSION_TIMEOUT_S,
    label: "setup",
  });
  try {
    try {
      await s.page.goto(SITE.homeUrl, {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT_MS,
      });
    } catch (e: any) {
      console.log(`[setup] goto soft-timeout (${e?.message ?? e})`);
    }
    console.log("\n" + "═".repeat(64));
    console.log("🔐 LOG IN MANUALLY IN LIVE VIEW");
    console.log("═".repeat(64));
    console.log(`\n  1. Open the Live View URL above.`);
    console.log(
      `  2. Click Sign In and log all the way INTO the authenticated program`,
    );
    console.log(
      `     (${SITE.loginHostHint}). Do not stop at the public ${"/ui/Home"} page.`,
    );
    console.log(
      `  3. Confirm you can see signed-in chrome (your name / Sign Out / saved searches).`,
    );
    console.log(`  4. Come back here and press Enter.\n`);

    const rl = createInterface({ input, output });
    await rl.question(
      "  Press Enter once you are logged into the authenticated program... ",
    );
    rl.close();

    console.log(
      "\n[setup] Verifying you actually landed inside (not the public /ui/Home bounce)...",
    );
    await sleep(1500);
    const cookies = await captureCookies(s.stagehand);
    const detected = await identifyWaf(s.stagehand, s.page, cookies);
    const obs = await observe(s.stagehand);
    const finalUrl = (() => {
      try {
        return s.page.url();
      } catch {
        return null;
      }
    })();
    const auth = classifyAuthState(finalUrl, obs, readAuthSignals(cookies));
    await snap(s.page, `setup-${profileName}`);

    console.log(`[setup] final URL: ${finalUrl}`);
    console.log(
      `[setup] auth state: ${auth.state.toUpperCase()} — ${auth.reason}`,
    );
    printDetect(detected);
    writeResult(`setup-${profileName}`, {
      ranAt: new Date().toISOString(),
      contextId,
      finalUrl,
      obs,
      detected,
      auth,
      sessionId: s.sessionId,
    });

    if (auth.state === "authenticated") {
      console.log(`\n✅ Logged in. Saving auth state into Context on close.`);
      console.log(
        `   Next:  BROWSERBASE_CONTEXT_ID=${contextId} npm run verify`,
      );
    } else {
      console.log(
        `\n⚠️  Could NOT confirm an authenticated session (state=${auth.state}).`,
      );
      console.log(
        `   The Context will still persist whatever cookies exist, but reuse is unlikely to work.`,
      );
      console.log(
        `   Re-run setup and make sure the signed-in UI is visible before pressing Enter.`,
      );
    }
  } finally {
    // Closing the session is what persists the Context.
    await s.stagehand.close().catch(() => {});
    console.log(
      `\n📦 Context ${contextId} closed (auth state persisted if login completed).`,
    );
  }
}

async function cmdVerify(profileName: ProfileName): Promise<void> {
  console.log(
    `\n=== VERIFY (the gating test: does the Context re-auth from a FRESH session?) ===`,
  );
  const contextId = process.env.BROWSERBASE_CONTEXT_ID?.trim();
  if (!contextId) {
    console.error(
      "❌ Set BROWSERBASE_CONTEXT_ID (from `npm run setup`) before verifying.",
    );
    process.exit(1);
  }
  // persist:false — test the CAPTURED state in isolation; don't let this run mutate it.
  const s = await openSession({
    profileName,
    contextId,
    persist: false,
    label: "verify",
  });
  try {
    const { obs, detected, auth, finalUrl } = await gotoSettleClassify(
      s,
      SITE.homeUrl,
    );
    await snap(s.page, `verify-${profileName}`);
    console.log(`\n[verify] final URL: ${finalUrl}`);
    console.log(`[verify] page: ${obs.summary}`);
    printDetect(detected);
    console.log(
      `[verify] auth state: ${auth.state.toUpperCase()} — ${auth.reason}`,
    );
    writeResult(`verify-${profileName}`, {
      ranAt: new Date().toISOString(),
      contextId,
      finalUrl,
      obs,
      detected,
      auth,
      sessionId: s.sessionId,
    });

    if (auth.state === "authenticated") {
      console.log(
        `\n✅ CONTEXT REUSE WORKS. A fresh session loaded already-authenticated — the OIDC/WAF callback is skipped entirely.`,
      );
      console.log(
        `   This is a real unblock: hand this contextId to the customer and run \`search\`.`,
      );
    } else {
      console.log(
        `\n❌ CONTEXT REUSE DID NOT AUTHENTICATE (state=${auth.state}).`,
      );
      console.log(
        `   The captured cookies did not re-authenticate from a new session — consistent with the site`,
      );
      console.log(
        `   binding the session to its original IP / TLS fingerprint. Every captcha-retry workaround is a`,
      );
      console.log(
        `   dead end; report this honestly rather than burning the customer's trial on it.`,
      );
    }
  } finally {
    await s.stagehand.close().catch(() => {});
  }
}

const SearchResults = z.object({
  results: z
    .array(
      z.object({
        caseNumber: z.string().nullable().describe("the case / cause number"),
        style: z
          .string()
          .nullable()
          .describe('the case style or title (e.g. "State v. Smith")'),
        court: z.string().nullable().describe("the court or location"),
        fileDate: z
          .string()
          .nullable()
          .describe("the file/filed date as shown"),
        caseType: z.string().nullable().describe("the case type or category"),
      }),
    )
    .describe("the visible court-records search results, one object per row"),
  resultCount: z
    .number()
    .nullable()
    .describe("the total result count if the page states one"),
  notes: z
    .string()
    .describe(
      "brief note on the page state (results shown, no results, login required, etc.)",
    ),
});

async function cmdSearch(
  profileName: ProfileName,
  query: string,
): Promise<void> {
  console.log(
    `\n=== SEARCH (search + extract — only counts if authenticated) ===`,
  );
  const contextId = process.env.BROWSERBASE_CONTEXT_ID?.trim();
  if (!contextId) {
    console.error(
      "❌ Set BROWSERBASE_CONTEXT_ID (from `npm run setup`) before searching.",
    );
    process.exit(1);
  }
  if (!query) {
    console.error('❌ Provide a query, e.g. npm run search -- "Smith"');
    process.exit(1);
  }
  const s = await openSession({
    profileName,
    contextId,
    persist: true,
    label: "search",
  });
  try {
    const { obs, auth, finalUrl, detected } = await gotoSettleClassify(
      s,
      SITE.homeUrl,
    );
    console.log(`\n[search] landing URL: ${finalUrl}`);
    console.log(
      `[search] auth state: ${auth.state.toUpperCase()} — ${auth.reason}`,
    );
    printDetect(detected);

    // Refuse to search on a logged-out page — a guest search would be misleading,
    // and on the signed-out landing there's no search box anyway (the act() calls
    // just churn with "no actionable element"). Stop and point at the real fix.
    if (auth.state !== "authenticated") {
      await snap(s.page, `search-${profileName}-not-authed`);
      console.log(
        `\n⚠️  Not authenticated on landing (state=${auth.state}) — stopping before searching.`,
      );
      if (auth.reason.includes("sess_loggedIn=false")) {
        console.log(
          `   The Context's saved login has expired (re:Search's RSCH_JWT lives ~12h). This is the`,
        );
        console.log(
          `   expected token-TTL lapse, NOT a binding failure — the earlier reuse proof still stands.`,
        );
      }
      console.log(
        `   Refresh it:  npm run setup   (log in again in Live View), then re-run this search.`,
      );
      writeResult(`search-${profileName}`, {
        ranAt: new Date().toISOString(),
        contextId,
        query,
        authenticatedOnLanding: false,
        auth,
        obs,
        finalUrl,
        results: null,
      });
      return;
    }
    console.log(
      `\n✅ Authenticated. Running the search as the logged-in user.`,
    );

    console.log(`[search] query: "${query}"`);
    await withRetry("act:open-search", () =>
      s.stagehand.act(
        "open or focus the court records search; if a search-type chooser is shown, choose to search by party name or case",
      ),
    ).catch(() => {});
    await withRetry("act:type-query", () =>
      s.stagehand.act("type %q% into the court records search box", {
        variables: { q: query },
      }),
    ).catch(() => {});
    await withRetry("act:submit", () =>
      s.stagehand.act(
        "submit the search (press Enter or click the Search button)",
      ),
    ).catch(() => {});
    await sleep(SETTLE_MS);

    const extracted = (
      await withRetry("extract:results", () =>
        s.stagehand.extract(
          [
            `Extract the court-records search results currently visible for the query "${query}".`,
            "Return one object per result row with case number, style/title, court, file date, and case type.",
            "If the page shows no results, a login prompt, or an error, return an empty results array and explain in notes.",
          ].join(" "),
          SearchResults,
        ),
      )
    ).data;

    const finalCookies = await captureCookies(s.stagehand);
    const finalAuth = classifyAuthState(
      (() => {
        try {
          return s.page.url();
        } catch {
          return null;
        }
      })(),
      await observe(s.stagehand),
      readAuthSignals(finalCookies),
    );
    await snap(s.page, `search-${profileName}`);

    console.log(
      `\n[search] results extracted: ${extracted.results.length}${extracted.resultCount != null ? ` (page says ${extracted.resultCount})` : ""}`,
    );
    console.log(`[search] notes: ${extracted.notes}`);
    for (const r of extracted.results.slice(0, 10)) {
      console.log(
        `   • ${[r.caseNumber, r.style, r.court, r.fileDate].filter(Boolean).join("  |  ")}`,
      );
    }
    writeResult(`search-${profileName}`, {
      ranAt: new Date().toISOString(),
      contextId,
      query,
      authenticatedOnLanding: auth.state === "authenticated",
      authAfterSearch: finalAuth,
      results: extracted,
      sessionId: s.sessionId,
    });
  } finally {
    await s.stagehand.close().catch(() => {});
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────
function parseArgs(argv: string[]): {
  command: string;
  profile: ProfileName;
  query: string;
} {
  let command = "probe";
  let profile: ProfileName = DEFAULT_PROFILE;
  let query = "";
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--query" || a === "-q") query = argv[++i] ?? "";
    else if (a in PROFILES) profile = a as ProfileName;
    else positional.push(a);
  }
  if (positional[0]) command = positional[0];
  // allow a trailing bare query for `search`
  if (command === "search" && !query && positional[1])
    query = positional.slice(1).join(" ");
  return { command, profile, query };
}

async function main() {
  if (!API_KEY || !PROJECT_ID) {
    console.error(
      "Missing BROWSERBASE_API_KEY / BROWSERBASE_PROJECT_ID. Copy .env.example to .env and fill them in.",
    );
    process.exit(1);
  }
  const { command, profile, query } = parseArgs(process.argv.slice(2));
  console.log(`txcourts-context-test · ${SITE.label}`);
  switch (command) {
    case "probe":
      return cmdProbe(profile);
    case "setup":
      return cmdSetup(profile);
    case "verify":
      return cmdVerify(profile);
    case "search":
      return cmdSearch(profile, query);
    default:
      console.error(
        `Unknown command "${command}". Use: probe | setup | verify | search [profile] [--query "..."]`,
      );
      process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error("\nFatal:", e?.message ?? e);
    process.exit(1);
  });
}
