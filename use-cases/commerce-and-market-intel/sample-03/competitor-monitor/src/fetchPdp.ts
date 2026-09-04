import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "playwright-core";

import { CONFIG, COUNTRIES, type Competitor, type Country } from "./config";
import { createSession, type ManagedSession } from "./session";
import { adapterFor, adapterForUrl } from "./capture";
import { attachCaptchaTelemetry, classify, type Outcome } from "./blockDetect";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const OUT_DIR = path.join(HERE, "..", "output");

export interface FetchInput {
  url: string;
  country: Country;
  competitor?: Competitor; // inferred from the URL host if omitted
  id?: string; // payload filename stem
  savePayload?: boolean; // default true
  parse?: boolean; // opt-in AI parse (--parse); raw data is the deliverable
}

export interface AttemptTelemetry {
  outcome: Outcome;
  durationMs: number; // observed attempt work before teardown
  elapsedMs: number; // includes awaited teardown
  bytes: number;
  captchaEncountered: number;
  captchaSolved: number;
  sessionId: string;
}

export interface FetchRecord {
  url: string;
  competitor: Competitor;
  country: Country;
  outcome: Outcome;
  reason: string;
  source: string | null;
  note?: string;
  durationMs: number; // sum of observed work across attempts
  elapsedMs?: number; // URL elapsed time through final teardown
  attemptHistory?: AttemptTelemetry[];
  attempts: number;
  /** Outcome of attempt #1 before any retry — SAMPLE_ORG benchmarks first-pass success
   *  (their internal AliExpress runs at ~50% first-pass + heavy retries). */
  firstAttemptOutcome?: Outcome;
  bytes: number; // wire bytes (residential-proxy bandwidth proxy)
  captchaEncountered: number;
  captchaSolved: number;
  sessionId: string;
  liveViewUrl: string;
  payloadPath?: string;
  /** Rendered-page HTML artifact — the RAW deliverable (SAMPLE_ORG applies their own parsers). */
  rawHtmlPath?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Stable, filesystem-safe id for a product URL (Shopee i.<shop>.<item> aware). */
function deriveId(url: string, fallback: string): string {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/i\.(\d+)\.(\d+)/); // shopee ...-i.<shop>.<item>
    if (m) return `${m[1]}_${m[2]}`;
    const seg = u.pathname.split("/").filter(Boolean).pop() ?? fallback;
    return seg.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 60) || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Persist the per-item artifacts. SAMPLE_ORG's delivery contract (June 10 call) is RAW
 * data — they run their own parsers — so the rendered-page HTML is written for
 * every ok fetch; the structured payload .json is written only when the site
 * exposes a data envelope (Shopee SSR blob, Shein gbRawData, --parse extract).
 */
async function saveArtifacts(
  competitor: Competitor,
  country: Country,
  id: string,
  payload: unknown,
  rawHtml: string,
): Promise<{ payloadPath?: string; rawHtmlPath?: string }> {
  const dir = path.join(OUT_DIR, "payloads");
  await fs.mkdir(dir, { recursive: true });
  const stem = path.join(dir, `${competitor}-${country}-${id}`);
  const out: { payloadPath?: string; rawHtmlPath?: string } = {};
  if (payload != null) {
    out.payloadPath = `${stem}.json`;
    await fs.writeFile(out.payloadPath, JSON.stringify(payload, null, 2));
  }
  if (rawHtml) {
    out.rawHtmlPath = `${stem}.raw.html`;
    await fs.writeFile(out.rawHtmlPath, rawHtml);
  }
  return out;
}

/** Persist the HTML of a non-ok fetch under output/payloads/debug/ for diagnosis.
 *  Best-effort: a bookkeeping failure must never sink the fetch. */
async function saveFailureHtml(
  competitor: Competitor,
  country: Country,
  id: string,
  outcome: Outcome,
  html: string,
): Promise<void> {
  try {
    const dir = path.join(OUT_DIR, "payloads", "debug");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, `${competitor}-${country}-${id}.${outcome}.html`),
      html,
    );
  } catch {
    /* diagnostic only */
  }
}

/**
 * Append one line per finished URL to output/manifest.jsonl — the integration
 * surface SAMPLE_ORG consumes (url → artifacts → provenance → timings). Append-only
 * JSONL so concurrent workers can write safely and downstream tooling can tail it.
 */
async function appendManifest(rec: FetchRecord): Promise<void> {
  try {
    await fs.mkdir(OUT_DIR, { recursive: true });
    const row = {
      ts: new Date().toISOString(),
      url: rec.url,
      competitor: rec.competitor,
      country: rec.country,
      outcome: rec.outcome,
      reason: rec.reason,
      source: rec.source,
      note: rec.note,
      attempts: rec.attempts,
      firstAttemptOutcome: rec.firstAttemptOutcome,
      durationMs: rec.durationMs,
      elapsedMs: rec.elapsedMs,
      attemptHistory: rec.attemptHistory,
      captchaEncountered: rec.captchaEncountered,
      captchaSolved: rec.captchaSolved,
      bytes: rec.bytes,
      rawHtmlPath: rec.rawHtmlPath
        ? path.relative(OUT_DIR, rec.rawHtmlPath)
        : undefined,
      payloadPath: rec.payloadPath
        ? path.relative(OUT_DIR, rec.payloadPath)
        : undefined,
      sessionId: rec.sessionId,
    };
    await fs.appendFile(
      path.join(OUT_DIR, "manifest.jsonl"),
      JSON.stringify(row) + "\n",
    );
  } catch {
    /* manifest is best-effort — never fail a fetch over bookkeeping */
  }
}

/** True if we asked for a deep product path but ended up on the site root — the
 *  Shein homepage-bounce signature (a soft redirect / un-stuck nav under load). */
function landedOnRoot(intended: string, current: string): boolean {
  try {
    const want = new URL(intended);
    const got = new URL(current);
    const gotPath = got.pathname.replace(/\/+$/, "");
    return (
      want.host === got.host &&
      want.pathname.replace(/\/+$/, "").length > 1 &&
      gotPath.length === 0
    );
  } catch {
    return false;
  }
}

/** Drop image/media/font requests to slash proxy bandwidth (the dominant cost). */
async function blockHeavyAssets(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const t = route.request().resourceType();
    if (t === "image" || t === "media" || t === "font")
      route.abort().catch(() => {});
    else route.continue().catch(() => {});
  });
}

/** Sum real bytes-over-the-wire via CDP (what residential proxy billing meters). */
async function attachByteCounter(
  page: Page,
): Promise<{ bytes: () => number; detach: () => Promise<void> }> {
  try {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    let total = 0;
    cdp.on("Network.loadingFinished", (e: any) => {
      total += e?.encodedDataLength || 0;
    });
    return {
      bytes: () => total,
      detach: async () => {
        try {
          await cdp.detach();
        } catch {
          /* noop */
        }
      },
    };
  } catch {
    return { bytes: () => 0, detach: async () => {} };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core
// ─────────────────────────────────────────────────────────────────────────────

async function fetchOnce(
  input: FetchInput,
  attemptIndex: number,
): Promise<FetchRecord> {
  const adapter = input.competitor
    ? adapterFor(input.competitor)
    : adapterForUrl(input.url);
  if (!adapter)
    throw new Error(`No capture adapter matches URL host: ${input.url}`);

  const competitor = adapter.competitor;
  const country = input.country;
  const id = input.id ?? deriveId(input.url, "item");
  const base = {
    url: input.url,
    competitor,
    country,
    attempts: attemptIndex + 1,
  };

  const t0 = Date.now();
  let session: ManagedSession | null = null;
  let captcha: ReturnType<typeof attachCaptchaTelemetry> | undefined;
  let counter: Awaited<ReturnType<typeof attachByteCounter>> | undefined;
  let budgetTimer: ReturnType<typeof setTimeout> | undefined;
  let work: Promise<FetchRecord> | undefined;
  try {
    // Hard ceiling on the WHOLE attempt. Page-level timeouts (goto/waitForFunction)
    // can't fire when the CDP transport itself wedges — measured 2026-06-11, a
    // shein/BR cell hung 10 sessions to the 15-min project TTL with zero
    // completions. Racing the attempt keeps a wedged session to ≤attemptBudgetMs,
    // classified `blocked` so the fresh-session retry (and the stage gate) see it.
    work = (async (): Promise<FetchRecord> => {
      session = await createSession(country);
      const { pwPage, sessionId, liveViewUrl } = session;

      captcha = attachCaptchaTelemetry(pwPage);
      counter = await attachByteCounter(pwPage);
      await blockHeavyAssets(pwPage);

      // Some sites (Shein) only SSR product data for a warmed session — hit the
      // warm-up URL first to acquire cookies. At scale, persist these via a Context
      // (same mechanism as the login bootstrap, minus the login).
      if (adapter.warmupUrl) {
        // Warm the SAME storefront origin as the target PDP. Shein only SSRs its
        // inline globals for a session warmed on that country's host — a static
        // warmup (br.shein.com) leaves other-country stores (e.g. shein.com.co)
        // un-warmed, so the globals never hydrate. Derive the origin from the URL.
        let warmTarget = adapter.warmupUrl;
        try {
          warmTarget = new URL(input.url).origin + "/";
        } catch {
          /* malformed URL — fall back to the adapter's default warmup host */
        }
        try {
          await pwPage.goto(warmTarget, {
            waitUntil: "domcontentloaded",
            timeout: CONFIG.navTimeoutMs,
          });
          await pwPage.waitForTimeout(2000);
        } catch {
          /* warm-up is best-effort */
        }
      }

      // Arm capture BEFORE navigation (Shopee's XHR fires during load).
      const armed = adapter.arm(pwPage);

      let navStatus: number | null = null;
      try {
        const resp = await pwPage.goto(input.url, {
          waitUntil: "domcontentloaded",
          timeout: CONFIG.navTimeoutMs,
        });
        navStatus = resp?.status() ?? null;
        await pwPage.waitForTimeout(CONFIG.settleMs);
      } catch {
        /* navigation error/timeout — still try to read whatever rendered below */
      }

      // Homepage-bounce guard. Measured 2026-06-11 (Shein BR, 10-wide): the warm-up
      // leaves the session on the storefront root, and under concurrency the PDP nav
      // sometimes doesn't stick — we end up capturing the HOMEPAGE (6/10 empties were
      // the Shein home, no product). Fresh-IP retries didn't help (not IP reputation),
      // but the warm-up has now set cookies, so a single IN-SESSION re-goto usually
      // lands the product. Generic: only fires when we bounced to the origin root but
      // asked for a deep path.
      if (landedOnRoot(input.url, pwPage.url())) {
        try {
          const resp = await pwPage.goto(input.url, {
            waitUntil: "domcontentloaded",
            timeout: CONFIG.navTimeoutMs,
          });
          navStatus = resp?.status() ?? navStatus;
          await pwPage.waitForTimeout(CONFIG.settleMs);
        } catch {
          /* re-nav best-effort */
        }
      }

      // If a CAPTCHA is being solved, give the (server-side) solver time before we
      // capture — solves can take up to ~30s, and capturing too early yields an empty
      // page. We wait for the browserbase-solving-finished console event our telemetry
      // counts (bounded).
      const solveDeadline = Date.now() + 25_000;
      while (
        captcha.encountered > captcha.solved &&
        Date.now() < solveDeadline
      ) {
        await pwPage.waitForTimeout(1000);
      }

      const cap = await armed.collect(pwPage, {
        stagehand: session.stagehand,
        parse: input.parse,
      });
      let html = "";
      try {
        html = await pwPage.content();
      } catch {
        html = "";
      }

      const bytes = counter.bytes() || Buffer.byteLength(html);
      let { outcome, reason } = classify({
        navStatus,
        captureOk: cap.ok,
        bodyText: html,
        bodyBytes: bytes,
      });
      // A CAPTCHA that appeared but never solved is a block, not DOM drift — retry
      // with a fresh session (a fresh IP frequently dodges the challenge entirely).
      if (outcome !== "ok" && captcha.encountered > captcha.solved) {
        outcome = "blocked";
        reason = `unsolved CAPTCHA (${captcha.solved}/${captcha.encountered})`;
      }
      // An adapter that intercepts a defended API (Temu's oak/render) can flag a block
      // directly — the shell HTML rendered 200 (would look 'empty'), but the product
      // API was 403'd/CAPTCHA'd. Honor it so the fresh-IP retry kicks in.
      if (outcome !== "ok" && cap.blocked) {
        outcome = "blocked";
        reason = cap.note ?? "adapter signaled anti-bot block";
      }
      // Still on the storefront root after the re-nav guard → a soft-redirect bounce,
      // not DOM drift. Classify as `blocked` (it IS a block — SAMPLE_ORG's real concern) so
      // it's reported honestly and a fresh-session retry gets another shot.
      if (outcome !== "ok" && landedOnRoot(input.url, pwPage.url())) {
        outcome = "blocked";
        reason = "soft-redirect to storefront homepage (PDP nav did not stick)";
      }

      captcha.detach();
      await counter.detach();

      let payloadPath: string | undefined;
      let rawHtmlPath: string | undefined;
      if (outcome === "ok" && (input.savePayload ?? true)) {
        ({ payloadPath, rawHtmlPath } = await saveArtifacts(
          competitor,
          country,
          id,
          cap.payload,
          html,
        ));
      } else if (outcome !== "ok" && (input.savePayload ?? true) && html) {
        // Diagnostic: keep the HTML of a miss so a capture failure leaves evidence
        // (this is exactly what was missing when the Shein empties had to be guessed
        // at). Distinct `.<outcome>.html` name — NOT a deliverable, so no rawHtmlPath.
        await saveFailureHtml(competitor, country, id, outcome, html);
      }

      return {
        ...base,
        outcome,
        reason,
        source: cap.source,
        note: cap.note,
        durationMs: Date.now() - t0,
        bytes,
        captchaEncountered: captcha.encountered,
        captchaSolved: captcha.solved,
        sessionId,
        liveViewUrl,
        payloadPath,
        rawHtmlPath,
      };
    })();

    const budget = new Promise<never>((_, reject) => {
      budgetTimer = setTimeout(
        () =>
          reject(
            new Error(
              `attempt budget exceeded (${CONFIG.attemptBudgetMs / 1000}s) — transport/page wedged`,
            ),
          ),
        CONFIG.attemptBudgetMs,
      );
    });
    return await Promise.race([work, budget]);
  } catch (e: any) {
    // Session/proxy/connect failure or attempt-budget breach — treat as blocked so
    // the retry loop tries a fresh session (and therefore a fresh IP).
    const msg = `${e?.message ?? String(e)}`;
    return {
      ...base,
      outcome: "blocked",
      reason: msg.includes("attempt budget") ? msg : "session/navigation error",
      source: null,
      durationMs: Date.now() - t0,
      bytes: counter?.bytes() ?? 0,
      captchaEncountered: captcha?.encountered ?? 0,
      captchaSolved: captcha?.solved ?? 0,
      sessionId: (session as ManagedSession | null)?.sessionId ?? "",
      liveViewUrl: (session as ManagedSession | null)?.liveViewUrl ?? "",
      error: `${e?.name ?? "Error"}: ${msg}`,
    };
  } finally {
    if (budgetTimer) clearTimeout(budgetTimer);
    // A raced-out `work` settles later — swallow its rejection so it can't surface
    // as an unhandled rejection after we've already returned the blocked record.
    work?.catch(() => {});
    if (session) {
      // Bounded close: if teardown itself wedges, the server-side session timeout
      // (CONFIG.sessionTimeoutSec) is the cost backstop — don't hang the worker.
      await Promise.race([
        (session as ManagedSession).close(),
        new Promise((r) => setTimeout(r, 15_000)),
      ]);
    }
  }
}

/** Fetch a URL with bounded fresh-session retries, retaining every attempt. */
export async function fetchPdp(input: FetchInput): Promise<FetchRecord> {
  const started = Date.now();
  const history: AttemptTelemetry[] = [];
  let rec: FetchRecord;
  do {
    const attemptStarted = Date.now();
    rec = await fetchOnce(input, history.length);
    history.push({
      outcome: rec.outcome, durationMs: rec.durationMs,
      elapsedMs: Math.max(0, Date.now() - attemptStarted), bytes: rec.bytes,
      captchaEncountered: rec.captchaEncountered, captchaSolved: rec.captchaSolved,
      sessionId: rec.sessionId,
    });
  } while ((rec.outcome === "blocked" || rec.outcome === "empty") && history.length <= CONFIG.maxRetries);
  const result: FetchRecord = {
    ...rec, attempts: history.length, firstAttemptOutcome: history[0]!.outcome,
    attemptHistory: history, elapsedMs: Math.max(0, Date.now() - started),
    durationMs: history.reduce((sum, attempt) => sum + attempt.durationMs, 0),
    bytes: history.reduce((sum, attempt) => sum + attempt.bytes, 0),
    captchaEncountered: history.reduce((sum, attempt) => sum + attempt.captchaEncountered, 0),
    captchaSolved: history.reduce((sum, attempt) => sum + attempt.captchaSolved, 0),
  };
  await appendManifest(result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI: single-URL smoke test —  npm run one -- <pdp_url> [country=BR] [competitor]
// ─────────────────────────────────────────────────────────────────────────────
async function cli(): Promise<void> {
  const argv = process.argv.slice(2);
  const parse = argv.includes("--parse");
  const [url, countryArg = "BR", competitorArg] = argv.filter(
    (a) => !a.startsWith("--"),
  );
  if (!url) {
    console.error(
      "usage: npm run one -- <pdp_url> [country=BR] [competitor] [--parse]",
    );
    process.exit(1);
  }
  const country = (COUNTRIES as string[]).includes(countryArg)
    ? (countryArg as Country)
    : "BR";
  if (country !== countryArg) {
    console.warn(`⚠️  unknown country "${countryArg}", defaulting to BR\n`);
  }

  console.log(`\n🔎 Fetching ${url}`);
  console.log(
    `   country=${country}${competitorArg ? ` competitor=${competitorArg}` : " (inferred from host)"}\n`,
  );

  const rec = await fetchPdp({
    url,
    country,
    competitor: competitorArg as Competitor | undefined,
    parse,
  });

  console.log(`📺 live view: ${rec.liveViewUrl}\n`);
  console.log(`outcome:  ${rec.outcome.toUpperCase()} (${rec.reason})`);
  console.log(
    `source:   ${rec.source ?? "—"}${rec.note ? `  [${rec.note}]` : ""}`,
  );
  console.log(
    `attempts: ${rec.attempts} (first-pass: ${rec.firstAttemptOutcome ?? "—"})   ` +
      `URL elapsed: ${((rec.elapsedMs ?? rec.durationMs) / 1000).toFixed(1)}s   summed attempt work: ${(rec.durationMs / 1000).toFixed(1)}s   observed bytes: ${(rec.bytes / 1024).toFixed(0)} KB`,
  );
  console.log(
    `captcha:  encountered=${rec.captchaEncountered} solved=${rec.captchaSolved}`,
  );
  if (rec.rawHtmlPath) console.log(`raw html: ${rec.rawHtmlPath}`);
  if (rec.payloadPath) console.log(`payload:  ${rec.payloadPath}`);
  if (rec.error) console.log(`error:    ${rec.error}`);
  process.exit(rec.outcome === "ok" ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
