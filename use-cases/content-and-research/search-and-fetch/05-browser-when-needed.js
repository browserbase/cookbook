/**
 * 05 — BROWSER, only when you actually need one  ·  the other ~15%
 * ───────────────────────────────────────────────────────────────────────────
 * Search + Fetch cover many public pages. This script is the boundary:
 * some pages are JS-rendered single-page apps where Fetch returns an EMPTY
 * shell. Try it — Fetch this OpenGov procurement portal
 * and you get 0 chars of content. The listings only exist after JavaScript runs.
 *
 * THAT is when you spin up a real browser. Same API key. Browserbase gives you a
 * managed Chrome (Verified, proxies, CAPTCHA solving, session replay) so you're
 * NOT running ECS + Playwright yourself.
 *
 *   Run:  BROWSERBASE_API_KEY=… node 05-browser-when-needed.js
 *
 * Uses @browserbasehq/sdk to create the session + playwright-core to drive it.
 */

import { pathToFileURL } from "node:url";

const KEY = process.env.BROWSERBASE_API_KEY;
const PORTAL = "https://procurement.opengov.com/portal/palo-alto-ca";

export async function fetchedContentLength(url, request = fetch) {
  // First, PROVE Fetch can't read it — this is the decision evidence.
  const res = await request("https://api.browserbase.com/v1/fetch", {
    method: "POST",
    headers: { "X-BB-API-Key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ url, format: "markdown", allowRedirects: true }),
  });
  const out = await res.json();
  return typeof out.content === "string" ? out.content.length : 0;
}

export function contentIsSufficient({ title = "", characters = 0 }, minimumCharacters = 500) {
  return !/just a moment|attention required/i.test(title) && characters >= minimumCharacters;
}

export async function waitForRenderedContent(page, { attempts = 20, delayMs = 2000 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const state = {
      title: await page.title(),
      characters: await page.evaluate(() => document.body?.innerText.length ?? 0),
    };
    if (contentIsSufficient(state)) return state;
    if (attempt + 1 < attempts) await page.waitForTimeout(delayMs);
  }
  throw new Error(`Browser content did not become ready after ${attempts} checks.`);
}

export async function main({ request = fetch, BrowserbaseClient, browserType } = {}) {
  console.log(
    `\nBROWSER TIER — for pages Fetch can't read\n  url: ${PORTAL}\n`,
  );

  // Step 1 — show WHY: Fetch returns an empty SPA shell.
  const chars = await fetchedContentLength(PORTAL, request);
  if (chars >= 500) {
    console.log(`  Fetch returned ${chars} chars, which satisfies this example's content requirement.`);
    console.log(`  Browser escalation is unnecessary for this response.`);
    return { tier: "fetch", characters: chars };
  }
  console.log(`  Fetch returned ${chars} chars, below the 500-character requirement.`);
  console.log(`  ⇒ This is a browser job.\n`);

  if (!BrowserbaseClient) BrowserbaseClient = (await import("@browserbasehq/sdk")).Browserbase;
  if (!browserType) browserType = (await import("playwright-core")).chromium;

  // ════════════════════════════════════════════════════════════════════════
  //  👉 CREATE A BROWSERBASE SESSION — managed Chrome, not your ECS box
  // ════════════════════════════════════════════════════════════════════════
  const bb = new BrowserbaseClient({ apiKey: KEY });
  const session = await bb.sessions.create({
    proxies: true, // OpenGov is behind Cloudflare
    browserSettings: {
      solveCaptchas: true, // Browserbase auto-solves challenges
      verified: true, // Verified browser fingerprint for protected sites
    },
  });
  console.log(`  session created: ${session.id}`);
  console.log(
    `  live replay → https://browserbase.com/sessions/${session.id}\n`,
  );

  // Connect Playwright to the cloud browser over CDP (session.connectUrl).
  const browser = await browserType.connectOverCDP(session.connectUrl);
  try {
    const page = browser.contexts()[0].pages()[0];

    // Now JavaScript runs — the content Fetch couldn't see renders here.
    await page.goto(PORTAL, { waitUntil: "domcontentloaded", timeout: 60_000 });

    // Cloudflare shows "Just a moment…" while Browserbase solves the challenge
    // (Verified + proxies + auto-CAPTCHA). Wait for the real app to take over.
    const { title, characters: rendered } = await waitForRenderedContent(page);
    console.log(
      `  ✅ Cloudflare cleared + SPA rendered: "${title}" (${rendered} chars)\n`,
    );

    // Read the content the SPA painted client-side — the stuff Fetch saw as 0 bytes.
    const snippet = await page.evaluate(() =>
      (document.body ? document.body.innerText : "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 14),
    );
    console.log(
      "  ── content the browser rendered (Fetch saw none of this) ──",
    );
    snippet.forEach((l) => console.log(`    ${l}`));
    console.log(
      `\n  ↑ The live, JS-rendered Palo Alto procurement portal — RFP/RFQ/RFI listings,`,
    );
    console.log(
      `    departments, calendar. From here you'd click into a project or grab the table.`,
    );
  } finally {
    await browser.close();
  }

  console.log(`
  TAKEAWAY:
    • Static gov pages (most of them) → Fetch.   No browser, ~$1–7 / 1k.
    • JS apps / portals / logins (this) → Browserbase browser. Managed, not ECS.
    • Same API key, same dashboard, one decision: "did Fetch see content?"
`);
  return { tier: "browser", sessionId: session.id };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
