import { readApiResponse } from "./api-response.js";

/**
 * 01 — SEARCH API  ·  replaces a separate search service
 * ───────────────────────────────────────────────────────────────────────────
 * A typical workflow uses a search API to find candidate pages.
 *
 * Browserbase Search is a single REST endpoint (powered by Exa) that returns
 * ranked, navigational URLs — same shape as Serper, but on the same API key as
 * your fetches and browsers. NO browser is spun up here.
 *
 *   Run:  BROWSERBASE_API_KEY=… node 01-search.js
 *         node 01-search.js "City of Gilbert Arizona" "ALPR license plate reader"
 *

 */

const KEY = process.env.BROWSERBASE_API_KEY;

// CLI args: entity + the buying-signal keywords for the use case you are researching.
const entity = process.argv[2] || "City of San Marcos Texas";
const signal =
  process.argv[3] ||
  "ALPR license plate recognition RFP solicitation public safety";

async function search(query, numResults = 6) {
  // ════════════════════════════════════════════════════════════════════════
  //  👉 THE SEARCH API CALL — this is the line that replaces Serper
  // ════════════════════════════════════════════════════════════════════════
  const res = await fetch("https://api.browserbase.com/v1/search", {
    method: "POST",
    headers: {
      "X-BB-API-Key": KEY, // same key as fetch + browsers
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query, // free-text, optimized for "where do I start"
      numResults, // 1–25
    }),
  });
  // Response: { requestId, query, results: [{ url, title, description, image, favicon }] }
  return readApiResponse(res, "search");
}

(async () => {
  const query = `${entity} ${signal}`;
  console.log(`\nSEARCH (Serper replacement)\n  query: "${query}"\n`);

  const t = Date.now();
  const { results } = await search(query);
  console.log(
    `  ${results.length} ranked pages in ${Date.now() - t}ms — no browser, no proxy bytes\n`,
  );

  results.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.title || "(untitled)"}`);
    console.log(`     ${r.url}\n`);
  });

  console.log(
    "Next: hand these URLs to 02-fetch.js (read) or 03-extract-signal.js (structured signal).\n",
  );
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
