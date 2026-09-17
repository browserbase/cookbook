import { readApiResponse } from "./api-response.js";

/**
 * 04 — SEARCH → DECIDE → FETCH  ·  a reusable nightly loop for ONE entity
 * ───────────────────────────────────────────────────────────────────────────
 * Puts 01 + 02 + 03 together as a reusable pipeline:
 *   search the entity → for each page, DECIDE fetch-vs-browser → extract signal.
 *
 * This is the "search → fetch → decide → browse" tiering from our Fetch post.
 * The whole point: only the ~15% of pages that truly need rendering hit a
 * browser. Everything else is a cheap Fetch. Look for  ⬇ THE DECISION  below.
 *
 *   Run:  BROWSERBASE_API_KEY=… node 04-search-to-signal.js
 *         node 04-search-to-signal.js "City of Gilbert Arizona"
 */

const KEY = process.env.BROWSERBASE_API_KEY;
const entity = process.argv[2] || "City of San Marcos Texas";

const TARGET = {
  name: "Example Vendor",
  buys: "license plate recognition (ALPR) / public safety",
};
const SIGNAL_SCHEMA = {
  type: "object",
  properties: {
    entity: { type: "string" },
    title: { type: "string" },
    stage: { type: "string" },
    due_date: { type: "string" },
    is_relevant: {
      type: "boolean",
      description: `relevant to ${TARGET.buys}`,
    },
    signal: { type: "string", description: `why ${TARGET.name} cares` },
  },
};

// ⬇ THE DECISION — fetch handles static AND server-rendered HTML (incl. ASPX,
// which renders server-side — Fetch reads it fine). A browser is needed only for
// client-rendered JS apps, post-login portals, or multi-step flows: OpenGov /
// Bonfire procurement portals, dashboards, anything that's a SPA.
const NEEDS_BROWSER = (url) =>
  /opengov\.com|bonfirehub\.com|\/portal\/|app\.|login|dashboard/i.test(url);

async function bb(path, body) {
  const res = await fetch(`https://api.browserbase.com/v1/${path}`, {
    method: "POST",
    headers: { "X-BB-API-Key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readApiResponse(res, path);
}

(async () => {
  console.log(`\nENTITY: ${entity}   (hunting ${TARGET.name} signals)\n`);

  // 1) SEARCH — find candidate pages (Serper replacement)
  const { results } = await bb("search", {
    query: `${entity} ${TARGET.buys} RFP solicitation budget council`,
    numResults: 6,
  });
  console.log(`SEARCH → ${results.length} pages\n`);

  let fetched = 0,
    deferred = 0;
  const signals = [];

  for (const r of results.slice(0, 4)) {
    if (NEEDS_BROWSER(r.url)) {
      // 2a) BROWSER TIER — do NOT fetch. Route to a real session (05-browser-when-needed.js).
      deferred++;
      console.log(`🌐 DEFERRED  ${r.url}`);
      console.log(
        `            URL heuristic suggests browser review; no session launched\n`,
      );
      continue;
    }
    // 2b) FETCH TIER — static page, read + extract the signal, no browser.
    fetched++;
    const out = await bb("fetch", {
      url: r.url,
      format: "json",
      schema: SIGNAL_SCHEMA,
      allowRedirects: true,
      proxies: true,
    });
    const c = out.content && typeof out.content === "object" ? out.content : {};
    if (c.is_relevant === true) {
      signals.push(c);
      console.log(`✅ SIGNAL   ${r.url}`);
      console.log(`            ${c.title || ""}  [${c.stage || "?"}]`);
      console.log(`            → ${c.signal}\n`);
    } else {
      console.log(`·  fetched  ${r.url}  — no signal\n`);
    }
  }

  console.log("────────────────────────────────────────────────────────────");
  console.log(
    `  ${signals.length} signals · ${fetched} fetches (no browser) · ${deferred} pages deferred for browser review`,
  );
  console.log(
    `  This summary covers the sampled pages only. Deferred URLs have not been fetched or opened in a browser.\n`,
  );
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
