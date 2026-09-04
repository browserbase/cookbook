/**
 * 02 — FETCH API  ·  replaces the "bazooka to kill a fly" Playwright crawl
 * ───────────────────────────────────────────────────────────────────────────
 * Brandon: "we use a bazooka to kill a fly — we throw Playwright at everything
 * where some of these might just need curl requests. Could your service do that?"
 * Our Fetch launch literally opens with: "spinning up a full browser session to
 * read a page is like killing a mosquito with a rocket launcher." This is it.
 *
 * Fetch does an HTTP GET on Browserbase infra (optional proxies) and returns the
 * page — NO browser, NO ECS container, NO Playwright upgrade to babysit.
 *
 *   Run:  BROWSERBASE_API_KEY=… node 02-fetch.js
 *         node 02-fetch.js https://www.gilbertaz.gov/departments/finance-mgmt-services/purchasing-division/rfp-cip-open-bids
 *
 * Pricing:  raw $1 / 1k pages   ·   markdown $4 / 1k   ·   json+proxies $7 / 1k
 *           (vs paying for a full browser MINUTE while a gov site loads for 5)
 */

const KEY = process.env.BROWSERBASE_API_KEY;
// Default to a content-rich page (a real council news story). Any URL works.
const url =
  process.argv[2] ||
  "https://communityimpact.com/austin/san-marcos-buda-kyle/government/2025/02/19/san-marcos-city-council-delays-decision-on-license-plate-readers-amid-privacy-concerns/";

let requestCount = 0;

async function fetchPage(url, format) {
  requestCount++;
  // ════════════════════════════════════════════════════════════════════════
  //  👉 THE FETCH API CALL — no browser involved
  // ════════════════════════════════════════════════════════════════════════
  const res = await fetch("https://api.browserbase.com/v1/fetch", {
    method: "POST",
    headers: { "X-BB-API-Key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      format, // "raw" (cheapest) | "markdown" | "json"
      allowRedirects: true, // gov URLs love to redirect (Brandon's "city site got bought")
      proxies: true, // route through Browserbase proxies for blocked sites
    }),
  });
  // Response: { statusCode, headers, content, contentType, encoding, requestId }
  return res.json();
}

// Markdown extract occasionally 500s on a complex page — retry once before giving up.
async function fetchMarkdown(url) {
  let last;
  for (let i = 0; i < 2; i++) {
    const r = await fetchPage(url, "markdown");
    last = r;
    if (
      r.statusCode === 200 &&
      typeof r.content === "string" &&
      r.content.length
    )
      return r;
  }
  return last;
}

(async () => {
  console.log(`\nFETCH (no browser)\n  url: ${url}\n`);

  // (a) RAW — the cheapest read. Good when you just want the HTML to parse yourself.
  let t = Date.now();
  const raw = await fetchPage(url, "raw");
  const rawLen = typeof raw.content === "string" ? raw.content.length : 0;
  console.log(
    `  raw      → HTTP ${raw.statusCode}, ${rawLen} bytes, ${Date.now() - t}ms  ($0.001)`,
  );

  // (b) MARKDOWN — clean, model-ready text. This is the "ready HTML" Brandon wanted.
  t = Date.now();
  const md = await fetchMarkdown(url);
  let mdContent = typeof md.content === "string" ? md.content : "";
  let mdLen = mdContent.length;
  let contentSource = "Markdown content";

  if (md.statusCode !== 200 || !mdLen) {
    contentSource = "Raw HTML text fallback";
    // Rare transient extract error — fall back to a text preview from the raw HTML
    // so the demo always shows content. (Same page reads fine on the next call.)
    console.log(
      `  markdown → HTTP ${md.statusCode} (extract hiccup) — falling back to raw text\n`,
    );
    mdContent = (typeof raw.content === "string" ? raw.content : "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
    mdLen = mdContent.length;
  } else {
    console.log(
      `  markdown → HTTP ${md.statusCode}, ${mdLen} chars, ${Date.now() - t}ms  ($0.004)\n`,
    );
  }

  // Page markdown always LEADS with site nav/header (that's DOM order). For a
  // readable preview, skip the nav chrome and show the substantive content lines.
  let meaty = mdContent
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 40 && !/^[-*]?\s*\[.*\]\(.*\)\s*$/.test(l)) // drop pure link/nav lines
    .slice(0, 18);

  // Raw-text fallback is one long line — chunk it so the preview still reads well.
  if (meaty.length < 3) {
    meaty = (mdContent.match(/.{1,100}/g) || []).slice(0, 14);
  }

  console.log(`  ── ${contentSource} preview ──`);
  meaty.forEach((l) => console.log("  " + l.slice(0, 100)));

  console.log(`
  ${contentSource} = ${mdLen.toLocaleString()} chars; ${requestCount} API requests (raw and markdown attempts combined).
  NOTE: raw markdown includes page chrome (nav/header). When you want ONLY the
  signal — no chrome — use Fetch with format:"json" + a schema → see 03-extract-signal.js.
`);
})();
