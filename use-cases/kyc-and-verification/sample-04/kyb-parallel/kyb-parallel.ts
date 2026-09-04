import Browserbase from "@browserbasehq/sdk";
import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
// Retailer Marketplace KYB Demo — 3 parallel checks via Stagehand + Browserbase
//
// Demoed merchant: Anker Innovations (US legal entity: ANKER NORTH AMERICA, LLC),
// a real top-tier Retailer Marketplace seller. The three checks below run concurrently
// against three independent public registries — total wall-clock time is bounded by
// the slowest single check, not the sum.
//
//   1) Delaware Division of Corporations → legal entity exists and file # is on record
//   2) OFAC SDN sanctions list           → displayed name-query results only
//   3) USPTO trademark search            → brand has live US trademarks, owner matches
//
// Each check runs in its own Stagehand session (separate Browserbase browser, IP,
// concurrent slot). Stagehand's default API mode routes all act/extract/observe
// through Browserbase's managed model gateway — no LLM provider key required —
// and turns on server-side action caching automatically, so re-runs replay cached
// actions instead of round-tripping to the model.

import "dotenv/config";
import { fileURLToPath } from "node:url";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";

export type KybEvent =
  | {
      type: "session_started";
      check: string;
      sessionId: string;
      liveViewUrl: string;
    }
  | { type: "check_completed"; check: string; result: any }
  | { type: "report"; report: KybReport }
  | { type: "error"; check?: string; message: string };

export type KybReport = {
  merchant: typeof MERCHANT;
  verdict: "PASS" | "FAIL" | "UNKNOWN";
  wallClockSeconds: number;
  checks: { entity: any; sanctions: any; trademark: any };
};

type EventCallback = (event: KybEvent) => void;

// Force the Browserbase model gateway to use its server-managed provider key.
// Stagehand otherwise auto-loads any local model API keys (GOOGLE_API_KEY,
// GOOGLE_GENERATIVE_AI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY) from env
// and forwards them via the x-model-api-key header — which means a stale key
// in your shell rc files would override the managed gateway path. Deleting
// them here keeps the demo on the "no LLM key needed" story.
for (const k of [
  "GOOGLE_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
]) {
  delete process.env[k];
}

// Model name still tells the gateway which provider to route to.
// No LLM provider key needed locally — Browserbase's Stagehand API
// (enabled by default via `disableAPI: false`) handles auth on the server.
const MODEL = "google/gemini-3-flash-preview";

const MERCHANT = {
  legalName: "ANKER NORTH AMERICA, LLC",
  delawareSearchTerm: "Anker North America",
  brand: "ANKER",
};

type CheckBaseResult = { sessionId: string; tookMs: number };

async function runCheck<T>(opts: {
  name: string;
  fn: (stagehand: Stagehand) => Promise<T>;
  browserSettings?: { solveCaptchas?: boolean; advancedStealth?: boolean };
  onEvent?: EventCallback;
}): Promise<T & CheckBaseResult> {
  // Every check goes through a residential proxy (proxies: true) and Browserbase's
  // verified-browser mode (browserSettings.verified: true) so KYB sites see a clean,
  // human-looking session — same posture Retailer's analysts would use manually.
  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await browserbase.launch({
        apiKey: process.env.BROWSERBASE_API_KEY!,
        projectId: process.env.BROWSERBASE_PROJECT_ID,
        ...({
          proxies: true,
          browserSettings: {
            verified: true,
            ...(opts.browserSettings ?? {}),
          },
        } as any),
      }),
      model: MODEL,
    }),
  );

  const sessionId = stagehand.browser.sessionId as string;
  // Fetch the embeddable live view URL for this session.
  const liveViewUrl = (
    await new Browserbase({
      apiKey: process.env.BROWSERBASE_API_KEY,
    }).sessions.debug(stagehand.browser.sessionId!)
  ).debuggerFullscreenUrl;
  console.log(`[${opts.name}] live view: ${liveViewUrl}`);
  opts.onEvent?.({
    type: "session_started",
    check: opts.name,
    sessionId,
    liveViewUrl,
  });

  const t0 = Date.now();
  try {
    const result = await opts.fn(stagehand);
    const out = { ...result, sessionId, tookMs: Date.now() - t0 };
    opts.onEvent?.({ type: "check_completed", check: opts.name, result: out });
    return out;
  } finally {
    await stagehand.close();
    await stagehand.browser.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 1: Delaware Division of Corporations entity search
// ─────────────────────────────────────────────────────────────────────────────
async function delawareSoS(stagehand: Stagehand) {
  const page = (await stagehand.browser.context.pages())[0];
  await page.goto(
    "https://icis.corp.delaware.gov/Ecorp/EntitySearch/NameSearch.aspx",
    { waitUntil: "domcontentloaded" },
  );

  await stagehand.act("type %name% into the entity-name search input field", {
    variables: { name: MERCHANT.delawareSearchTerm },
  });
  await stagehand.act(
    "click the search button to submit the entity name search",
  );

  // ASP.NET postback fires off after the click; give the results table time
  // to render. (Stagehand's API-mode Page proxy doesn't reliably forward
  // page.waitForLoadState, so we use a deterministic sleep instead.)
  await new Promise((r) => setTimeout(r, 5000));

  const extracted = (
    await stagehand.extract(
      'From the Delaware Division of Corporations results table, find any row whose entity name contains "Anker North America". Return its file number and full entity name. Also return the total number of result rows in the table.',
      z.object({
        found: z
          .boolean()
          .describe("true if a row matching the search term is present"),
        fileNumber: z
          .string()
          .nullable()
          .describe('Delaware file number of the matching row, e.g. "5772050"'),
        entityName: z
          .string()
          .nullable()
          .describe("Full entity name of the matching row"),
        totalResults: z
          .number()
          .describe("Total number of rows in the results table"),
      }),
    )
  ).data;

  return {
    check: "delaware_sos" as const,
    ...extracted,
    pass: extracted.found,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 2: OFAC SDN sanctions screening
// ─────────────────────────────────────────────────────────────────────────────
function observeOfacResults(input: { mode: 'arm' | 'read' | 'clear'; name: string; armedAt?: number }) {
  const stateWindow = window as Window & { cookbookOfac?: { observer: MutationObserver; updated: boolean } };
  const marker = /Lookup Results:\s*(\d+)\s*Found/i;
  if (input.mode === 'clear') {
    stateWindow.cookbookOfac?.observer.disconnect();
    delete stateWindow.cookbookOfac;
    return { updated: false, queryMatches: false, matchCount: null, armedAt: 0 };
  }
  if (input.mode === 'arm') {
    stateWindow.cookbookOfac?.observer.disconnect();
    const observer = new MutationObserver(records => {
      if (records.some(record => /^Lookup Results:\s*\d+\s*Found\s*$/i.test((record.target.textContent ?? '').trim()) ||
          (record.type === 'characterData' && marker.test(record.target.parentElement?.textContent ?? '')) ||
          [...record.addedNodes, ...record.removedNodes].some(node => marker.test(node.textContent ?? '')))) {
        if (stateWindow.cookbookOfac) stateWindow.cookbookOfac.updated = true;
      }
    });
    stateWindow.cookbookOfac = { observer, updated: false };
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  }
  const text = document.body.innerText;
  const count = text.match(marker);
  const expected = input.name.trim().toLowerCase();
  const queryMatches = [...document.querySelectorAll<HTMLInputElement>('input')].some(el =>
    el.getClientRects().length > 0 && el.type !== 'hidden' && el.value.trim().toLowerCase() === expected);
  return {
    updated: stateWindow.cookbookOfac?.updated ?? (input.armedAt !== undefined && performance.timeOrigin > input.armedAt),
    queryMatches, matchCount: count ? Number(count[1]) : null, armedAt: Date.now(),
  };
}

async function ofacSdn(stagehand: Stagehand) {
  const unknown = (reason: string) => ({ check: 'ofac_sdn' as const, status: 'unknown' as const, pass: null, matchCount: null, matches: [] as string[], reason });
  const page = (await stagehand.browser.context.pages())[0];
  if (!page) return unknown('No browser page available');
  try {
    await page.goto('https://sanctionssearch.ofac.treas.gov/', { waitUntil: 'domcontentloaded' });
    const typed = await stagehand.act('type %name% into the Last Name search field', { variables: { name: MERCHANT.legalName } });
    if (!typed.data.success) return unknown('Search name entry was not confirmed');
    const armed = await page.evaluate(observeOfacResults, { mode: 'arm', name: MERCHANT.legalName });
    if (!armed.queryMatches) return unknown('Visible search input does not match the requested name');
    const submitted = await stagehand.act('click the Search button to run the OFAC SDN sanctions search');
    if (!submitted.data.success) return unknown('Search submission was not confirmed');
    let receipt: Awaited<ReturnType<typeof observeOfacResults>> | null = null;
    for (let i = 0; i < 40; i++) {
      const observed = await page.evaluate(observeOfacResults, { mode: 'read', name: MERCHANT.legalName, armedAt: armed.armedAt });
      if (observed.updated && observed.queryMatches && observed.matchCount !== null) { receipt = observed; break; }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!receipt) return unknown('No updated results count was observed for the entered name');
    const schema = z.object({ matchCount: z.number().int().nonnegative(), matches: z.array(z.string().trim().min(1)) })
      .refine(value => value.matchCount === value.matches.length, 'Result count and matched-name list must agree');
    const extracted = schema.parse((await stagehand.extract('Read the displayed Lookup Results count and every matched entity name. Do not infer missing rows.', schema)).data);
    if (extracted.matchCount !== receipt.matchCount) return unknown('Visible and extracted results counts disagree');
    return { check: 'ofac_sdn' as const, status: extracted.matchCount === 0 ? 'no_matches' as const : 'matches' as const,
      ...extracted, pass: extracted.matchCount === 0,
      reason: 'Observed results for this exact demo name query only; not comprehensive sanctions clearance' };
  } catch { return unknown('Search or extraction failed or returned inconsistent evidence'); }
  finally { await page.evaluate(observeOfacResults, { mode: 'clear', name: MERCHANT.legalName }).catch(() => {}); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 3: USPTO trademark search
// ─────────────────────────────────────────────────────────────────────────────
async function usptoTrademark(stagehand: Stagehand) {
  const page = (await stagehand.browser.context.pages())[0];
  await page.goto("https://tmsearch.uspto.gov/search/search-information", {
    waitUntil: "domcontentloaded",
  });

  await stagehand.act("type %brand% into the trademark search bar", {
    variables: { brand: MERCHANT.brand },
  });

  await stagehand.act("press the Enter key to submit the trademark search");

  // USPTO TM search is a SPA that navigates to /search-results, and the site
  // sits behind an AWS WAF "mp_verify" challenge that adds variable latency.
  // Poll for the URL change instead of a fixed sleep, with a 10s ceiling —
  // typical nav happens in <5s — then give the result list a moment to paint.
  const navStart = Date.now();
  while (Date.now() - navStart < 10000) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      if (
        typeof page.url === "function" &&
        /search-results/.test(await page.url())
      )
        break;
    } catch {
      // Stagehand's Page proxy may not expose .url() — fall through to the timeout.
    }
  }
  await new Promise((r) => setTimeout(r, 4000));

  const trademarkSchema = z.object({
    liveCount: z
      .number()
      .nullable()
      .describe("Total live trademark count for this brand"),
    topOwners: z
      .array(z.string())
      .describe("Distinct registered-owner names, up to ~10"),
  });
  const extractInstruction =
    'From the USPTO trademark search results page, return the total live trademark count visible on the page (the number alongside "results" or "trademarks"), and the distinct registered-owner names visible in the top results (up to ~10 distinct owners, in order of appearance).';

  let extracted = (await stagehand.extract(extractInstruction, trademarkSchema))
    .data;
  // Safety net: if the SPA was mid-render when we extracted, the LLM sees an
  // empty results container and returns 0/[]. Wait briefly and retry once
  // before giving up — this is the only check on a real SPA, and the WAF
  // challenge timing means it occasionally needs the second look.
  if (!extracted.liveCount || extracted.topOwners.length === 0) {
    await new Promise((r) => setTimeout(r, 5000));
    extracted = (await stagehand.extract(extractInstruction, trademarkSchema))
      .data;
  }

  const ownsBrand = extracted.topOwners.some((o) =>
    /anker innovations/i.test(o),
  );
  return {
    check: "uspto_trademark" as const,
    ...extracted,
    ownsBrand,
    pass: !!extracted.liveCount && extracted.liveCount > 0 && ownsBrand,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Run all three in parallel
// ─────────────────────────────────────────────────────────────────────────────
export async function runKyb(onEvent?: EventCallback): Promise<KybReport> {
  const startedAt = Date.now();

  const [entity, sanctions, trademark] = await Promise.all([
    runCheck({
      name: "DE SoS",
      fn: delawareSoS,
      browserSettings: { solveCaptchas: true },
      onEvent,
    }),
    runCheck({
      name: "OFAC  ",
      fn: ofacSdn,
      onEvent,
    }),
    runCheck({
      name: "USPTO ",
      fn: usptoTrademark,
      browserSettings: { solveCaptchas: true, advancedStealth: true },
      onEvent,
    }),
  ]);

  const wallClockMs = Date.now() - startedAt;
  const verdict: KybReport["verdict"] = sanctions.pass === null ? "UNKNOWN" :
    entity.pass && sanctions.pass && trademark.pass ? "PASS" : "FAIL";

  return {
    merchant: MERCHANT,
    verdict,
    wallClockSeconds: +(wallClockMs / 1000).toFixed(1),
    checks: { entity, sanctions, trademark },
  };
}

// CLI entry — only runs when this file is invoked directly, not when imported.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(
    `\nKYB verification for: ${MERCHANT.legalName} (brand: ${MERCHANT.brand})\n`,
  );
  const report = await runKyb();
  console.log("\n──────── KYB REPORT ────────");
  console.log(JSON.stringify(report, null, 2));
  console.log(
    `\nWall clock: ${report.wallClockSeconds}s (all three checks in parallel)`,
  );
  console.log(`Verdict: ${report.verdict}\n`);
}
