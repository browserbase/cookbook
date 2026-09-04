import type { Page } from "playwright-core";
import type { ArmedCapture, CaptureResult, CompetitorAdapter } from "./types";
import { safeHost } from "./types";
import { CONFIG } from "../config";

// Shein server-renders the full PDP payload into a `<script>window.gbRawData = {…}`
// block (goods_name, productInfo, priceInfo, currency, …). The catch: the runtime
// GLOBAL `window.gbRawData` is only assigned after Shein's async
// `SRenderInitialPropsLoaded` event fires — so reading the global races hydration
// (measured 2026-06-11: successes took 60s+, and 20–30% first-pass with the rest
// timing out as `empty` despite a full ~5 MB page). The data is sitting in the
// HTML text the whole time, so we parse it STATICALLY from page.content() instead
// — timing-independent, the same approach that makes Shopee's SSR blob reliable.
//
// Shein only SSRs these globals for a warmed session, so we still hit the
// country's homepage first (fetchPdp uses warmupUrl) to acquire cookies.
const SHEIN_WARMUP = "https://br.shein.com/";
const ASSIGN_MARKER = "gbRawData = ";

/**
 * Extract a balanced, string-aware `{…}` object starting at the first `{` at or
 * after `from`. Brace-counts while ignoring braces inside JSON string literals
 * (and their escapes), so a `}` inside a product description can't end it early.
 */
function extractBalancedJson(html: string, from: number): string | null {
  const start = html.indexOf("{", from);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = start; j < html.length; j++) {
    const c = html[j];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === "\\") {
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return html.slice(start, j + 1);
    }
  }
  return null; // unbalanced (truncated stream) — caller retries on fresh content
}

/** Parse the SSR `window.gbRawData = {…}` payload out of page HTML, or null. */
function parseGbRawData(html: string): unknown | null {
  const i = html.indexOf(ASSIGN_MARKER);
  if (i < 0) return null;
  const raw = extractBalancedJson(html, i + ASSIGN_MARKER.length);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** True if the parsed blob actually carries product data (not an SEO-only stub).
 *  Verified live (2026-06-11 debug HTML): real PDPs nest the product under
 *  `gbRawData.modules.{productInfo,priceInfo,…}`; top-level keys are just
 *  `googleSEO / modules / canonicalInfo`. Older locales used `productIntroData`,
 *  and some flatten goods fields — accept any of the three shapes. */
function hasProductData(payload: any): boolean {
  if (!payload || typeof payload !== "object") return false;
  const m = payload.modules;
  if (m && typeof m === "object" && (m.productInfo || m.priceInfo || m.detail))
    return true;
  const p = payload.productIntroData;
  if (
    p &&
    typeof p === "object" &&
    (p.goods_id || p.goods_name || p.productInfo || p.detail)
  )
    return true;
  return !!(payload.goods_id || payload.goods_name);
}

export const sheinAdapter: CompetitorAdapter = {
  competitor: "shein",
  hostMatch: /(^|\.)shein\./i,
  warmupUrl: SHEIN_WARMUP,

  matches(url: string) {
    return this.hostMatch.test(safeHost(url));
  },

  arm(): ArmedCapture {
    return {
      async collect(page: Page): Promise<CaptureResult> {
        // The SSR script is in the initial document, so it's present by collect()
        // time (post-settle). Bounded re-reads cover a still-streaming response —
        // far cheaper than the old 20s global-hydration wait, and deterministic.
        const deadline = Date.now() + CONFIG.inlineWaitMs;
        let html = "";
        let payload: unknown | null = null;
        let sawMarker = false;
        do {
          try {
            html = await page.content();
          } catch {
            html = "";
          }
          if (html.includes(ASSIGN_MARKER)) {
            sawMarker = true;
            const parsed = parseGbRawData(html);
            if (hasProductData(parsed)) {
              payload = parsed;
              break;
            }
          }
          await page.waitForTimeout(750);
        } while (Date.now() < deadline);

        if (payload) {
          return {
            ok: true,
            source: "ssr:gbRawData",
            payload,
            note: "parsed window.gbRawData from SSR HTML (timing-independent)",
          };
        }

        // Fallback: read the runtime global directly, in case the assignment
        // markup ever shifts (e.g. bracket-notation). Last resort — same data,
        // but subject to the hydration race the static parse avoids.
        try {
          const g = await page.evaluate(
            "(function(){var v=window.gbRawData;return v&&typeof v==='object'?v:null;})()",
          );
          if (hasProductData(g)) {
            return {
              ok: true,
              source: "window.gbRawData",
              payload: g,
              note: "static parse missed; recovered via runtime global",
            };
          }
        } catch {
          /* global not ready */
        }

        return {
          ok: false,
          source: null,
          payload: null,
          note: sawMarker
            ? "gbRawData script present but JSON unbalanced/incomplete (truncated stream)"
            : "no gbRawData SSR script in HTML (un-warmed session or non-PDP)",
        };
      },
    };
  },
};
