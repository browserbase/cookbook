import { readApiResponse } from "./api-response.js";

/**
 * 03 — FETCH EXTRACT (json)  ·  structured page extraction in one call
 * ───────────────────────────────────────────────────────────────────────────
 * The extraction example turns an unstructured public page into a typed record.
 *
 * Fetch with `format: "json"` + a JSON Schema does the page read AND the
 * extraction in ONE request — no browser, no separate LLM plumbing, no heuristics
 * like "only if it has an email on it."
 *
 *   Run:  BROWSERBASE_API_KEY=… node 03-extract-signal.js
 *         node 03-extract-signal.js "https://some.gov/bid/123"
 *

 */

const KEY = process.env.BROWSERBASE_API_KEY;
const url =
  process.argv[2] ||
  "https://www.bidnetdirect.com/texas/solicitations/open-bids/Law-Enforcement-Automated-License-Plate-Recognition-ALPR-Technology/0000411983";

// The organization whose requirements define relevance. Swap this and the schema follows.
const TARGET = {
  name: "Example Vendor",
  buys: "license plate recognition (ALPR) / public safety software",
};

// The output schema. This schema is the only thing you tune per use case.
const SIGNAL_SCHEMA = {
  type: "object",
  properties: {
    entity: { type: "string", description: "government entity issuing this" },
    title: { type: "string" },
    category: {
      type: "string",
      description: "what product/service is being procured",
    },
    stage: {
      type: "string",
      description: "RFI / RFP / budgeted / awarded / exploring",
    },
    due_date: { type: "string" },
    is_relevant: {
      type: "boolean",
      description: `true if relevant to ${TARGET.buys}`,
    },
    signal: {
      type: "string",
      description: `one sentence: why ${TARGET.name} should care, and how early this is`,
    },
  },
};

(async () => {
  console.log(
    `\nFETCH EXTRACT → buying signal for ${TARGET.name}\n  url: ${url}\n`,
  );

  const t = Date.now();
  // ════════════════════════════════════════════════════════════════════════
  //  👉 THE FETCH-EXTRACT CALL — read + structured extraction, no browser
  // ════════════════════════════════════════════════════════════════════════
  const res = await fetch("https://api.browserbase.com/v1/fetch", {
    method: "POST",
    headers: { "X-BB-API-Key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      format: "json", // <-- triggers extraction
      schema: SIGNAL_SCHEMA, // <-- your use-case signal shape
      allowRedirects: true,
      proxies: true,
    }),
  });
  const out = await readApiResponse(res, "fetch");
  const signal =
    out.content && typeof out.content === "object" ? out.content : out.content;

  console.log(`  extracted in ${Date.now() - t}ms  (HTTP ${out.statusCode})\n`);
  console.log(JSON.stringify(signal, null, 2).replace(/^/gm, "  "));
  console.log(`
  That JSON is a reusable structured record. No ECS, no Playwright, no parsing pipeline —
  one Fetch call turned a raw gov page into the reusable structured artifact.
`);
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
