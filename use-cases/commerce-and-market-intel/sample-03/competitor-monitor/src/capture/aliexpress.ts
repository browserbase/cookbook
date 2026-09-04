import { z } from "zod";
import type { Page } from "playwright-core";
import type {
  ArmedCapture,
  CaptureContext,
  CaptureResult,
  CompetitorAdapter,
} from "./types";
import { safeHost } from "./types";
import { CONFIG } from "../config";

// AliExpress deprecated `window.runParams` (now an empty {}) and renders the PDP
// client-side, so there's no inline data blob to read.
//
// SAMPLE_ORG's delivery contract (June 10 call) is RAW data — they apply their own
// parsers — so the deliverable here is the rendered-page HTML, persisted by
// fetchPdp for every ok fetch. This adapter's job is only to confirm the PDP
// actually rendered product content (vs a challenge/empty shell): wait for the
// product title to hydrate (h1 / og:title), then report ok.
//
// Structured extraction (Stagehand AI over the DOM) remains available behind
// `--parse` as a value-add — kept OFF the scale path, since the LLM round-trip
// is slower and stalls under concurrent load.
const SCHEMA = z.object({
  title: z.string().nullable().describe("full product title"),
  price: z
    .string()
    .nullable()
    .describe("current price as shown, including currency symbol"),
  originalPrice: z
    .string()
    .nullable()
    .describe("list/original price before discount, if shown"),
  rating: z.string().nullable().describe('average star rating, e.g. "4.6"'),
  reviewCount: z.string().nullable().describe("number of reviews/ratings"),
  unitsSold: z.string().nullable().describe('units sold, e.g. "1,000+ sold"'),
  storeName: z.string().nullable().describe("seller/store name"),
  shipsTo: z.string().nullable().describe("ship-to / delivery location shown"),
  specs: z
    .array(z.object({ name: z.string(), value: z.string() }))
    .describe("product specification/attribute name-value pairs"),
});

const INSTRUCTION =
  "Extract the product details from this AliExpress product page: the product title, " +
  "current price (with currency symbol), original/list price, average star rating, number " +
  "of reviews, units sold, store/seller name, ship-to location, and the key " +
  "specification/attribute name-value pairs. Use null for anything not visible.";

// Product-rendered signal. Two live findings drove this shape:
//  • AliExpress pages carry a generic `<h1>Aliexpress` header besides the real
//    `<h1 data-pl="product-title">` — "any h1" matches the header on shell pages.
//  • A matrix run (aliexpress-MX-3, 2026-06-11) saved an interstitial with NO
//    h1/og:title that had passed a looser length-based gate at collect time —
//    so the gate also requires a PRICE token ($ amount, any LatAm currency
//    prefix) in the body before calling the PDP rendered. A product page
//    without a price is not a capture.
// String expression for waitForFunction — sidesteps the tsx/esbuild __name
// issue with passed functions (see types.ts).
const PDP_READ =
  `(function(){` +
  `var p=document.querySelector('h1[data-pl="product-title"]');` +
  `var t=p?(p.textContent||'').replace(/\\s+/g,' ').trim():'';` +
  `if(!t||t.length<8){` +
  `var m=document.querySelector('meta[property="og:title"]');` +
  `var mt=m?(m.getAttribute('content')||'').replace(/\\s+/g,' ').trim():'';` +
  `t=mt.length>=20?mt:'';` +
  `}` +
  `if(!t)return '';` +
  `var body=(document.body&&document.body.innerText||'').slice(0,40000);` +
  `if(!/[A-Z]{0,3}\\$[A-Z]{0,3}\\s?[\\d.,]+/.test(body))return '';` +
  `return t;` +
  `})()`;
const RENDERED_COND = `${PDP_READ}.length>0`;

export const aliexpressAdapter: CompetitorAdapter = {
  competitor: "aliexpress",
  hostMatch: /(^|\.)aliexpress\./i,

  matches(url: string) {
    return this.hostMatch.test(safeHost(url));
  },

  arm(): ArmedCapture {
    return {
      async collect(page: Page, ctx?: CaptureContext): Promise<CaptureResult> {
        try {
          await page.waitForFunction(RENDERED_COND, undefined, {
            timeout: CONFIG.inlineWaitMs,
            polling: 500,
          });
        } catch {
          /* timed out — do a final read anyway in case of a near-miss */
        }

        // Same string expression as the wait condition (single source of truth).
        const title = (await page.evaluate(PDP_READ)) as string;

        if (!title) {
          return {
            ok: false,
            source: null,
            payload: null,
            note: "no product title + price in rendered DOM — not a hydrated PDP (classify decides blocked vs empty)",
          };
        }

        // Raw mode (default): the rendered HTML fetchPdp persists IS the payload.
        if (!ctx?.parse) {
          return {
            ok: true,
            source: "dom:rendered-html",
            payload: null,
            note: `rendered PDP detected ("${title.slice(0, 60)}") — raw HTML is the deliverable`,
          };
        }

        // --parse: structured extraction as a bonus artifact.
        if (!ctx.stagehand) {
          return {
            ok: true,
            source: "dom:rendered-html",
            payload: null,
            note: "--parse requested but no Stagehand instance; raw HTML only",
          };
        }
        try {
          const response = await ctx.stagehand.extract(INSTRUCTION, SCHEMA);
          const result = SCHEMA.safeParse(response.data);
          const parsed = result.success && Boolean(result.data.title?.trim());
          return {
            ok: true,
            source: parsed ? "stagehand:extract" : "dom:rendered-html",
            payload: parsed && result.success ? result.data : null,
            note: parsed
              ? "raw HTML + Stagehand parse (--parse)"
              : "Stagehand extract returned invalid product data or no title; raw HTML only",
          };
        } catch {
          return {
            ok: true,
            source: "dom:rendered-html",
            payload: null,
            note: "Stagehand extract failed; raw HTML only",
          };
        }
      },
    };
  },
};
