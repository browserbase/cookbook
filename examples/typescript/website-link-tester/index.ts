// Stagehand + Browserbase: Website Link Tester - See README.md for full documentation

import "dotenv/config";
import { browserbase, Stagehand, type StagehandBrowser } from "@browserbasehq/stagehand";
import { z } from "zod/v4";

// Base URL whose links we want to crawl and verify
const URL = "https://www.browserbase.com";
const configuredLinkLimit = Number(process.env.MAX_LINKS ?? Number.MAX_SAFE_INTEGER);
if (!Number.isSafeInteger(configuredLinkLimit) || configuredLinkLimit < 1) {
  throw new Error("MAX_LINKS must be a positive integer");
}
const MAX_LINKS = configuredLinkLimit;

// Maximum number of links to verify concurrently.
// Default: 1 (sequential processing - works on all plans)
// Set to > 1 for more concurrent link verification (requires Startup or Developer plan or higher).
// For more advanced concurrency control (rate limiting, prioritization, per-domain caps),
// you can also wrap link verification in a Semaphore or similar concurrency primitive.
const configuredConcurrency = Number(process.env.MAX_CONCURRENT_LINKS ?? "1");
if (!Number.isSafeInteger(configuredConcurrency) || configuredConcurrency < 1) {
  throw new Error("MAX_CONCURRENT_LINKS must be a positive integer");
}
const MAX_CONCURRENT_LINKS = configuredConcurrency;

// Shape of a single hyperlink extracted from the page
type Link = {
  url: string;
  linkText: string;
};

// Result of checking a single link, including any verification metadata
type LinkCheckResult = {
  linkText: string;
  url: string;
  success: boolean;
  reachable: boolean;
  contentStatus: "matched" | "mismatched" | "unknown" | "skipped";
  pageTitle?: string;
  contentMatches?: boolean;
  assessment?: string;
  error?: string;
};

// Domains that are treated as social links; we only check that they load,
// and skip content verification because they often require auth/consent flows.
const SOCIAL_DOMAINS = [
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "tiktok.com",
  "reddit.com",
  "discord.com",
];

// Creates a preconfigured Stagehand V4 instance and its Browserbase browser handle.
async function createStagehand(): Promise<{ stagehand: Stagehand; browser: StagehandBrowser }> {
  const browser = await browserbase.launch({
    apiKey: process.env.BROWSERBASE_API_KEY!,
  });
  const stagehand = await Stagehand.create({
    browser,
    logging: { level: "error" },
  });
  return { stagehand, browser };
}

async function closeSession(stagehand: Stagehand | null, browser: StagehandBrowser | null) {
  await stagehand?.close().catch((error) => console.warn("Stagehand cleanup warning:", error));
  await browser?.close().catch((error) => console.warn("Browser cleanup warning:", error));
}

// Removes duplicate links by URL while preserving the first occurrence
function deduplicateLinks(extractedLinks: { links: Link[] }): Link[] {
  const map = new Map<string, Link>();

  for (const link of extractedLinks.links) {
    if (!map.has(link.url)) {
      map.set(link.url, link);
    }
  }

  return Array.from(map.values());
}

/**
 * Opens the homepage and uses Stagehand `extract()` to collect all links.
 * Returns a de-duplicated array of link objects that we will later verify.
 */
async function collectLinksFromHomepage(): Promise<Link[]> {
  const { stagehand, browser } = await createStagehand();

  try {
    const page = (await browser.context.pages())[0];

    // Navigate to the base URL where we will harvest links
    console.log(`Navigating to ${URL}...`);
    await page.goto(URL);

    console.log(`Successfully loaded ${URL}. Extracting links...`);

    const { data: extractedLinks } = await stagehand.extract(
      "Extract all rendered links on the page with their visible link text or accessible label and their absolute HTTP(S) href. Return actual destination URLs.",
      z.object({
        links: z.array(
          z.object({
            url: z.string().url().describe("The absolute HTTP(S) href"),
            linkText: z.string(),
          }),
        ),
      }),
      { page },
    );

    // Remove duplicate URLs and log both raw and unique counts for visibility
    const uniqueLinks = deduplicateLinks(extractedLinks);

    console.log(
      `All links on the page (${extractedLinks.links.length} total, ${uniqueLinks.length} unique):`,
    );
    console.log(JSON.stringify({ links: uniqueLinks }, null, 2));

    console.log("\nClosing initial browser...");
    await closeSession(stagehand, browser);
    console.log("Initial browser closed");

    return uniqueLinks.slice(0, MAX_LINKS);
  } catch (error) {
    console.error("Error while collecting links:", error);
    // Ensure the browser is closed even when link collection fails
    await closeSession(stagehand, browser);
    throw error;
  }
}

/**
 * Verifies a single link by opening it in a dedicated browser session.
 * - Confirms the page loads successfully.
 * - For non-social links, uses `extract()` to check that the page content
 *   matches what the link text suggests.
 */
async function verifySingleLink(link: Link): Promise<LinkCheckResult> {
  console.log(`\nChecking: ${link.linkText} (${link.url})`);

  let browser: StagehandBrowser | null = null;
  let stagehand: Stagehand | null = null;
  let reachable = false;

  try {
    const requestedUrl = new globalThis.URL(link.url);
    if (!["http:", "https:"].includes(requestedUrl.protocol)) {
      throw new Error("Link must use HTTP(S)");
    }
    const hostname = requestedUrl.hostname.toLowerCase().replace(/\.$/, "");
    const isSocialLink = SOCIAL_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );

    ({ browser, stagehand } = await createStagehand());

    const page = (await browser.context.pages())[0];

    const navigationResponse = await page.goto(link.url, { timeout: 30000 });
    await page.waitForLoadState("domcontentloaded");

    if (!navigationResponse) {
      throw new Error("Navigation returned no HTTP response");
    }
    if (!navigationResponse.ok()) {
      throw new Error(
        `HTTP ${navigationResponse.status()} ${navigationResponse.statusText()}`.trim(),
      );
    }

    const currentUrl = await page.url();

    // Guard against pages that never load or redirect to an invalid URL
    const landedUrl = new globalThis.URL(currentUrl);
    if (!["http:", "https:"].includes(landedUrl.protocol)) {
      throw new Error("Page failed to load - invalid URL detected");
    }

    reachable = true;
    console.log(`Link opened successfully: ${link.linkText}`);

    // Skip semantic checks only when both the requested and landed hosts are social.
    const landedHostname = landedUrl.hostname.toLowerCase().replace(/\.$/, "");
    const landedOnSocialHost = SOCIAL_DOMAINS.some(
      (domain) => landedHostname === domain || landedHostname.endsWith(`.${domain}`),
    );
    if (isSocialLink && landedOnSocialHost) {
      console.log(`[${link.linkText}] Social media link - skipping content verification`);

      return {
        linkText: link.linkText,
        url: link.url,
        success: true,
        reachable,
        contentStatus: "skipped",
        pageTitle: "Social Media Link",
        assessment: "Social media link loaded successfully (content verification skipped)",
      };
    }

    // Retry transient extraction failures without treating reachability as semantic evidence.
    let verification:
      | { pageTitle: string; contentMatches: boolean; assessment: string }
      | undefined;
    let verificationError: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await stagehand.extract(
          `A user clicked a source-page link labeled ${JSON.stringify(link.linkText)} and arrived at ${JSON.stringify(currentUrl)}. Is the loaded destination an appropriate result of that click? Do not require the original call-to-action text to appear on the destination page. Generic labels such as "Read the story" and "Get started" are fulfilled by a relevant article or template page. Return the page title and a brief assessment (maximum 8 words).`,
          z.object({
            pageTitle: z.string(),
            contentMatches: z.boolean(),
            assessment: z.string(),
          }),
          { page },
        );
        verification = result.data;
        break;
      } catch (error) {
        verificationError = error;
        console.warn(`Semantic verification attempt ${attempt} failed for ${link.linkText}`);
      }
    }

    if (!verification) {
      throw verificationError ?? new Error("Content verification returned no result");
    }

    console.log(`[${link.linkText}] Page Title: ${verification.pageTitle}`);
    console.log(
      `[${link.linkText}] Content Matches: ${verification.contentMatches ? "YES" : "NO"}`,
    );
    console.log(`[${link.linkText}] Assessment: ${verification.assessment}`);

    return {
      linkText: link.linkText,
      url: link.url,
      success: verification.contentMatches,
      reachable,
      contentStatus: verification.contentMatches ? "matched" : "mismatched",
      pageTitle: verification.pageTitle,
      contentMatches: verification.contentMatches,
      assessment: verification.assessment,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`Failed to verify link "${link.linkText}": ${errorMessage}`);

    // On failure, return a structured result capturing the error message
    return {
      linkText: link.linkText,
      url: link.url,
      success: false,
      reachable,
      contentStatus: "unknown",
      error: errorMessage,
    };
  } finally {
    if (stagehand || browser) {
      await closeSession(stagehand, browser);
      if (browser) {
        console.log(`Browser closed for: ${link.linkText}`);
      }
    }
  }
}

/**
 * Verifies all links in batches to avoid opening too many concurrent sessions.
 * Returns an array of `LinkCheckResult` objects for all processed links.
 */
async function verifyLinksInBatches(links: Link[]): Promise<LinkCheckResult[]> {
  console.log(`\nVerifying links in batches of ${MAX_CONCURRENT_LINKS}...`);

  const results: LinkCheckResult[] = [];

  for (let i = 0; i < links.length; i += MAX_CONCURRENT_LINKS) {
    const batch = links.slice(i, i + MAX_CONCURRENT_LINKS);

    console.log(
      `\n=== Processing batch ${Math.floor(i / MAX_CONCURRENT_LINKS) + 1} (${batch.length} links) ===`,
    );

    const batchResults = await Promise.all(batch.map((link) => verifySingleLink(link)));

    results.push(...batchResults);

    console.log(
      `\nBatch ${Math.floor(i / MAX_CONCURRENT_LINKS) + 1} complete (${results.length} total verified)`,
    );
  }

  return results;
}

/**
 * Logs a JSON summary of all link verification results.
 * Falls back to a brief textual summary if JSON stringification fails.
 */
function outputResults(results: LinkCheckResult[], label: string = "FINAL RESULTS") {
  console.log("\n" + "=".repeat(80));
  console.log(label);
  console.log("=".repeat(80));

  const finalReport = {
    totalLinks: results.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    reachable: results.filter((r) => r.reachable).length,
    matched: results.filter((r) => r.contentStatus === "matched").length,
    mismatched: results.filter((r) => r.contentStatus === "mismatched").length,
    unknown: results.filter((r) => r.contentStatus === "unknown").length,
    skipped: results.filter((r) => r.contentStatus === "skipped").length,
    results,
  };

  try {
    console.log(JSON.stringify(finalReport, null, 2));
  } catch (stringifyError) {
    console.error("Error stringifying results:", stringifyError);
    console.log("Summary only:");
    console.log(`Total: ${finalReport.totalLinks}`);
    console.log(`Successful: ${finalReport.successful}`);
    console.log(`Failed: ${finalReport.failed}`);
  }

  console.log("\n" + "=".repeat(80));
}

/**
 * Orchestrates the full flow:
 * 1. Collect all links from the homepage.
 * 2. Verify them in batches.
 * 3. Print a final JSON report (or partial results if an error occurs).
 */
async function main() {
  console.log("Starting main function...");

  let results: LinkCheckResult[] = [];

  try {
    const links = await collectLinksFromHomepage();
    console.log(`Collected ${links.length} links, starting verification...`);

    results = await verifyLinksInBatches(links);

    console.log(`Results array length: ${results.length}`);

    outputResults(results);

    const failedChecks = results.filter((result) => !result.success);
    if (failedChecks.length > 0) {
      throw new Error(`${failedChecks.length} of ${results.length} links failed verification`);
    }

    console.log("Script completed successfully");
  } catch (error) {
    console.error("\nError occurred during execution:", error);

    if (results.length > 0) {
      console.log(`\nOutputting partial results (${results.length} links processed before error):`);
      outputResults(results, "PARTIAL RESULTS (Error Occurred)");
    } else {
      console.log("No results to output - error occurred before any links were verified");
    }

    throw error;
  }
}

main().catch((err) => {
  console.error("Application error:", err);
  process.exit(1);
});
