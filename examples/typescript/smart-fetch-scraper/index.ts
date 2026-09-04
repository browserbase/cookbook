// Stagehand + Browserbase: Smart Fetch Scraper - See README.md for full documentation
//
// Tries the Browserbase Fetch API first (fast, no browser session needed).
// If the page is JS-rendered or the content is insufficient, falls back to
// a full Stagehand browser session with AI-powered extraction.
//
// This example requests raw HTML. Markdown and JSON responses need different
// validation and parsing paths.

import "dotenv/config";
import Browserbase from "@browserbasehq/sdk";
import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod/v4";
import { load } from "cheerio";

// ============= CONFIGURATION =============

// Minimum character threshold — if Fetch API returns less than this,
// the page is likely JS-rendered and we fall back to a browser session.
const MIN_CONTENT_LENGTH = 500;

// Minimum ratio of parsed body text to raw HTML. This structural heuristic
// cannot establish CSS visibility, rendered completeness, or content relevance.
const MIN_TEXT_DENSITY = 0.05;

// Patterns that indicate the page requires JavaScript to render real content.
const JS_REQUIRED_PATTERNS = [
  /enable javascript/i,
  /javascript is (required|disabled|not enabled)/i,
  /please enable javascript/i,
  /this (site|page|app) requires javascript/i,
  /checking your browser/i, // Cloudflare challenge
  /<noscript>[^<]{200,}/i, // large noscript block = JS-gated content
];

// Schema for the structured data extracted by the browser fallback.
// Adapt this to match the content you want to pull from the target page.
const PageDataSchema = z.object({
  title: z.string().describe("The page title"),
  items: z
    .array(
      z.object({
        title: z.string().describe("The headline or item title"),
        url: z.string().describe("The link URL"),
        metadata: z.string().describe("Any subtitle, score, author, or timestamp info"),
      }),
    )
    .describe("The main list of items, articles, or entries on the page"),
});

// =========================================

/**
 * Returns the reason the Fetch API result should trigger a browser fallback,
 * or null if the content passes approximate structural heuristics.
 * Passing does not verify rendered visibility or completeness.
 */
function needsBrowserFallback(content: string, statusCode: number): string | null {
  // Non-2xx status: the page didn't load successfully
  if (statusCode < 200 || statusCode >= 300) {
    return `non-2xx status code (${statusCode})`;
  }

  // Too short: likely a JS shell
  if (content.length < MIN_CONTENT_LENGTH) {
    return `content too short (${content.length} < ${MIN_CONTENT_LENGTH} chars)`;
  }

  // JS-challenge / bot-detection page
  for (const pattern of JS_REQUIRED_PATTERNS) {
    if (pattern.test(content)) {
      return `JS-required pattern matched: ${pattern}`;
    }
  }

  // Exclude executable, inert, and explicitly hidden content before counting text.
  // A DOM parser keeps script literals and comments from becoming page content.
  const $ = load(content);
  $("script, style, template, noscript, [hidden]").remove();
  const textOnly = $("body").text().replace(/\s+/g, " ").trim();
  const density = textOnly.length / content.length;
  if (density < MIN_TEXT_DENSITY) {
    return `text density too low (${(density * 100).toFixed(1)}% < ${MIN_TEXT_DENSITY * 100}%)`;
  }

  return null;
}

/**
 * Attempt to fetch a page using the Browserbase Fetch API.
 * This is a lightweight HTTP request — no browser spins up.
 * Returns raw HTML or null if the response fails approximate structural checks.
 */
async function tryFetchApi(url: string): Promise<{ content: string; statusCode: number } | null> {
  const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });

  console.log("[Fetch API] Attempting lightweight fetch...");

  try {
    const data = await bb.fetchAPI.create({ url, allowRedirects: true, format: "raw" });
    if (typeof data.content !== "string") {
      console.log("[Fetch API] Expected raw HTML string; falling back to browser");
      return null;
    }
    const content = data.content;

    console.log(
      `[Fetch API] Got response: status=${data.statusCode}, length=${content.length} chars`,
    );

    const fallbackReason = needsBrowserFallback(content, data.statusCode);
    if (fallbackReason) {
      console.log(`[Fetch API] Structural check requested fallback — ${fallbackReason}`);
      return null;
    }

    return { content, statusCode: data.statusCode };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`[Fetch API] Failed: ${message}`);
    return null;
  }
}

/**
 * Parse basic data from raw HTML without a browser.
 * Decodes the title and counts body anchors outside inert or hidden content.
 * CSS visibility and rendered content are not verified.
 */
function parseFromHtml(html: string): { title: string; linkCount: number } {
  const $ = load(html);
  const title = $("head title").first().text().trim() || "Unknown";
  $("script, style, template, noscript, [hidden]").remove();
  const linkCount = $("body a").length;
  return { title, linkCount };
}

/**
 * Fall back to a full Stagehand browser session for JS-heavy pages.
 * Uses AI-powered extraction to pull structured data from the rendered DOM.
 */
async function extractWithBrowser(url: string) {
  console.log("\n[Browser] Starting Stagehand session...");

  const browser = await browserbase.launch({
    apiKey: process.env.BROWSERBASE_API_KEY!,
    proxies: true,
    browserSettings: {
      advancedStealth: true,
      blockAds: true,
      solveCaptchas: true,
    },
  });
  const stagehand = await Stagehand.create({
    browser: browser,
    logging: { level: "info" },
  });

  try {
    const page = (await browser.context.pages())[0];
    await page.goto(url);

    console.log("[Browser] Page loaded, extracting structured data with AI...");

    const { data: data } = await stagehand.extract(
      "Extract the page title and all the main items/articles/entries visible on this page. For each item get its title, URL, and any metadata like score, author, or timestamp.",
      PageDataSchema,
    );

    return data;
  } finally {
    await stagehand.close().catch((error) => console.warn("Stagehand cleanup warning:", error));
    await browser.close().catch((error) => console.warn("Browser cleanup warning:", error));
    console.log("[Browser] Session closed");
  }
}

async function main(): Promise<void> {
  const targetUrl = process.argv[2];
  if (!targetUrl) {
    console.error("Usage: pnpm start <url>");
    console.error("Example: pnpm start https://news.ycombinator.com");
    process.exit(1);
  }

  console.log(`Smart Fetch Scraper — target: ${targetUrl}`);
  console.log("Strategy: Fetch API first, browser fallback if needed\n");

  try {
    // Step 1: Try the fast path
    const fetchResult = await tryFetchApi(targetUrl);

    if (fetchResult) {
      console.log("\n[Fetch API] Structural heuristics passed. Parsing HTML content...");
      const parsed = parseFromHtml(fetchResult.content);
      console.log(`  Title: ${parsed.title}`);
      console.log(`  Links found: ${parsed.linkCount}`);
      console.log(`  Status code: ${fetchResult.statusCode}`);
      console.log(`  Content length: ${fetchResult.content.length} chars`);
      console.log("\nThe Fetch API response passed approximate structural heuristics; rendered visibility and completeness are unverified.");
      console.log("For richer structured extraction, the browser fallback is also available.\n");

      // Optionally, you can still use the browser for richer extraction:
      // const structured = await extractWithBrowser(targetUrl);
      // console.log(JSON.stringify(structured, null, 2));

      console.log("Preview (first 500 chars):");
      console.log(fetchResult.content.slice(0, 500));
    } else {
      // Step 2: Fetch failed or a structural heuristic requested browser fallback
      console.log("\n[Fetch API] Falling back to browser after fetch or structural check...\n");

      const structured = await extractWithBrowser(targetUrl);
      console.log("\nExtracted data:");
      console.log(JSON.stringify(structured, null, 2));
    }
  } catch (error) {
    console.error("Error during scrape:", error);
    throw error;
  }
}

main().catch((err) => {
  console.error("Error:", err);
  console.error("Common issues:");
  console.error("  - Check .env has BROWSERBASE_API_KEY");
  console.error("  - Verify network connectivity");
  console.error("Docs: https://docs.stagehand.dev");
  process.exit(1);
});
