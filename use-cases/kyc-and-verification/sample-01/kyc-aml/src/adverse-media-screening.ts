import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";
import { config } from "dotenv";
import type {
  CompanyIdentifier,
  AdverseMediaResult,
  AuditTrailEntry,
} from "./types.js";
import { AdverseMediaResultSchema } from "./types.js";
import {
  log,
  createAuditEntry,
  finalizeAuditEntry,
  sanitizeCompanyName,
  wait,
} from "./utils.js";

config();

// ============================================================
// Adverse Media Screening Module
// ============================================================
// Demonstrates automated adverse media screening across multiple
// news sources to identify negative coverage, regulatory actions,
// and reputational risks.
// ============================================================

interface AdverseMediaOutput {
  results: AdverseMediaResult[];
  auditTrail: AuditTrailEntry[];
  sources: string[];
  totalArticlesScanned: number;
}

/**
 * News sources to search for adverse media
 * These are publicly accessible news aggregators and search engines
 */
const NEWS_SOURCES = [
  {
    name: "Google News",
    url: "https://news.google.com",
    searchPath: "/search?q=",
  },
  {
    name: "Reuters",
    url: "https://www.reuters.com",
    searchPath: "/search?q=",
  },
  {
    name: "Financial Times (Headlines)",
    url: "https://www.ft.com",
    searchPath: "/search?q=",
  },
];

/**
 * Risk keywords to include in search queries for adverse media
 */
const RISK_KEYWORDS = [
  "fraud",
  "investigation",
  "lawsuit",
  "regulatory action",
  "fine",
  "penalty",
  "sanctions",
  "money laundering",
  "corruption",
  "bribery",
];

/**
 * Search Google News for adverse media about a company
 */
async function searchGoogleNews(
  stagehand: Stagehand,
  company: CompanyIdentifier,
  sessionId: string,
  sessionRecordingUrl?: string,
): Promise<{ results: AdverseMediaResult[]; audit: AuditTrailEntry }> {
  const audit = createAuditEntry(
    "Adverse Media Search - Google News",
    "Google News",
    sessionId,
    sessionRecordingUrl,
  );
  const startTime = Date.now();

  try {
    const page = (await stagehand.browser.context.activePage())!;
    const searchQuery = `${sanitizeCompanyName(company.name)} ${company.jurisdiction} (fraud OR investigation OR lawsuit OR scandal OR fine)`;

    log.info(`Searching Google News for: "${searchQuery}"`);

    await page.goto(
      `https://news.google.com/search?q=${encodeURIComponent(searchQuery)}&hl=en-US&gl=US&ceid=US:en`,
    );
    await page.waitForLoadState("networkidle");

    // Wait for results to load
    await wait(2000);

    // Extract news articles using Stagehand
    const extractedArticles = (
      await stagehand.extract(
        `Extract news article results from the Google News search page.

      For each article visible on the page, extract:
      - source: The news outlet/publisher name (e.g., "Reuters", "Bloomberg")
      - headline: The article headline/title
      - date: The publication date (if shown, otherwise null)
      - snippet: Any preview text or description shown

      Focus on articles that mention the company in a negative context
      (investigations, lawsuits, regulatory issues, scandals, fines).

      Extract up to 10 articles.`,
        z.object({
          articles: z
            .array(
              z.object({
                source: z.string(),
                headline: z.string(),
                date: z.string().nullable(),
                snippet: z.string(),
              }),
            )
            .max(10),
        }),
      )
    ).data;

    // Classify each article for risk category and sentiment
    const articles = extractedArticles.articles || [];
    const classifiedResults: AdverseMediaResult[] = articles.map((article) => {
      // Simple keyword-based classification (in production, use AI)
      const headlineLower = article.headline.toLowerCase();
      let riskCategory: AdverseMediaResult["riskCategory"] = "other";
      let sentiment: AdverseMediaResult["sentiment"] = "neutral";
      let relevanceScore = 50;

      if (headlineLower.includes("fraud") || headlineLower.includes("scam")) {
        riskCategory = "fraud";
        sentiment = "negative";
        relevanceScore = 90;
      } else if (
        headlineLower.includes("sanction") ||
        headlineLower.includes("banned")
      ) {
        riskCategory = "sanctions";
        sentiment = "negative";
        relevanceScore = 95;
      } else if (
        headlineLower.includes("money laundering") ||
        headlineLower.includes("aml")
      ) {
        riskCategory = "money_laundering";
        sentiment = "negative";
        relevanceScore = 90;
      } else if (
        headlineLower.includes("corrupt") ||
        headlineLower.includes("bribe")
      ) {
        riskCategory = "corruption";
        sentiment = "negative";
        relevanceScore = 85;
      } else if (
        headlineLower.includes("fine") ||
        headlineLower.includes("penalty") ||
        headlineLower.includes("regulator")
      ) {
        riskCategory = "regulatory_action";
        sentiment = "negative";
        relevanceScore = 75;
      } else if (
        headlineLower.includes("lawsuit") ||
        headlineLower.includes("sued") ||
        headlineLower.includes("court")
      ) {
        riskCategory = "litigation";
        sentiment = "negative";
        relevanceScore = 70;
      }

      return {
        source: article.source,
        headline: article.headline,
        date: article.date,
        url: null, // Google News doesn't expose direct URLs easily
        snippet: article.snippet,
        sentiment,
        riskCategory,
        relevanceScore,
      };
    });

    const finalAudit = finalizeAuditEntry(
      audit,
      true,
      `Found ${articles.length} articles`,
      startTime,
    );

    log.success(`Found ${articles.length} articles from Google News`);
    return { results: classifiedResults, audit: finalAudit };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error(`Google News search failed: ${errorMessage}`);
    return {
      results: [],
      audit: finalizeAuditEntry(audit, false, "", startTime, errorMessage),
    };
  }
}

/**
 * Search Reuters for adverse media
 */
async function searchReuters(
  stagehand: Stagehand,
  company: CompanyIdentifier,
  sessionId: string,
  sessionRecordingUrl?: string,
): Promise<{ results: AdverseMediaResult[]; audit: AuditTrailEntry }> {
  const audit = createAuditEntry(
    "Adverse Media Search - Reuters",
    "Reuters",
    sessionId,
    sessionRecordingUrl,
  );
  const startTime = Date.now();

  try {
    const page = (await stagehand.browser.context.activePage())!;
    const searchQuery = sanitizeCompanyName(company.name);

    log.info(`Searching Reuters for: "${searchQuery}"`);

    await page.goto(
      `https://www.reuters.com/search/news?blob=${encodeURIComponent(searchQuery)}`,
      {
        timeout: 60000,
      },
    );
    await page.waitForLoadState("domcontentloaded");
    await wait(3000);

    // Extract news articles
    const extractedArticles = (
      await stagehand.extract(
        `Extract search results from the Reuters news search page.

      For each article result, extract:
      - headline: The article title
      - date: Publication date
      - snippet: Article preview/summary text

      Extract up to 10 results.`,
        z.object({
          articles: z
            .array(
              z.object({
                headline: z.string(),
                date: z.string().nullable(),
                snippet: z.string(),
              }),
            )
            .max(10),
        }),
      )
    ).data;

    // Classify results
    const articles = extractedArticles.articles || [];
    const classifiedResults: AdverseMediaResult[] = articles.map((article) => {
      const headlineLower = article.headline.toLowerCase();
      let riskCategory: AdverseMediaResult["riskCategory"] = "other";
      let sentiment: AdverseMediaResult["sentiment"] = "neutral";
      let relevanceScore = 40;

      // Check for negative keywords
      const negativeKeywords = [
        "fraud",
        "investigation",
        "lawsuit",
        "fine",
        "penalty",
        "sanction",
        "corrupt",
        "scandal",
      ];
      for (const keyword of negativeKeywords) {
        if (headlineLower.includes(keyword)) {
          sentiment = "negative";
          relevanceScore = 80;
          break;
        }
      }

      return {
        source: "Reuters",
        headline: article.headline,
        date: article.date,
        url: null,
        snippet: article.snippet,
        sentiment,
        riskCategory,
        relevanceScore,
      };
    });

    const finalAudit = finalizeAuditEntry(
      audit,
      true,
      `Found ${articles.length} articles`,
      startTime,
    );

    log.success(`Found ${articles.length} articles from Reuters`);
    return { results: classifiedResults, audit: finalAudit };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error(`Reuters search failed: ${errorMessage}`);
    return {
      results: [],
      audit: finalizeAuditEntry(audit, false, "", startTime, errorMessage),
    };
  }
}

/**
 * Main adverse media screening function
 * Searches multiple news sources and aggregates results
 */
export async function screenAdverseMedia(
  company: CompanyIdentifier,
): Promise<AdverseMediaOutput> {
  log.section("ADVERSE MEDIA SCREENING");
  log.data("Company", company.name);
  log.data("Jurisdiction", company.jurisdiction);

  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await browserbase.launch({
        apiKey: process.env.BROWSERBASE_API_KEY!,
        projectId: process.env.BROWSERBASE_PROJECT_ID!,
        ...{
          browserSettings: {
            blockAds: true,
          },
        },
      }),
    }),
  );

  const allResults: AdverseMediaResult[] = [];
  const auditTrail: AuditTrailEntry[] = [];
  const sources: string[] = [];

  try {
    const sessionId = stagehand.browser.sessionId || "local";

    // Build the session recording URL directly
    const sessionRecordingUrl =
      sessionId !== "local"
        ? `https://www.browserbase.com/sessions/${sessionId}`
        : "Local session - no recording";

    log.info(`Session ID: ${sessionId}`);
    log.info(`Live View: ${sessionRecordingUrl}`);

    // Search Google News
    log.subsection("Google News Search");
    const googleResults = await searchGoogleNews(
      stagehand,
      company,
      sessionId,
      sessionRecordingUrl,
    );
    allResults.push(...googleResults.results);
    auditTrail.push(googleResults.audit);
    sources.push("Google News");

    // Wait between searches to avoid rate limiting
    await wait(2000);

    // Search Reuters
    log.subsection("Reuters Search");
    const reutersResults = await searchReuters(
      stagehand,
      company,
      sessionId,
      sessionRecordingUrl,
    );
    allResults.push(...reutersResults.results);
    auditTrail.push(reutersResults.audit);
    sources.push("Reuters");

    // Sort results by relevance and sentiment
    allResults.sort((a, b) => {
      if (a.sentiment === "negative" && b.sentiment !== "negative") return -1;
      if (b.sentiment === "negative" && a.sentiment !== "negative") return 1;
      return b.relevanceScore - a.relevanceScore;
    });

    await stagehand.close();
    await stagehand.browser.close();

    // Display results summary
    log.section("ADVERSE MEDIA RESULTS SUMMARY");
    const negativeCount = allResults.filter(
      (r) => r.sentiment === "negative",
    ).length;
    log.data("Total Articles Found", allResults.length.toString());
    log.data("Negative Sentiment", negativeCount.toString());
    log.data("Sources Searched", sources.length.toString());

    if (negativeCount > 0) {
      log.subsection("High-Risk Articles");
      allResults
        .filter((r) => r.sentiment === "negative")
        .slice(0, 5)
        .forEach((article, i) => {
          console.log(`\n  ${i + 1}. ${article.headline}`);
          console.log(
            `     Source: ${article.source} | Category: ${article.riskCategory}`,
          );
          console.log(`     Relevance: ${article.relevanceScore}%`);
        });
    }

    return {
      results: allResults,
      auditTrail,
      sources,
      totalArticlesScanned: allResults.length,
    };
  } catch (error) {
    log.error(`Adverse media screening failed: ${error}`);
    try {
      await stagehand.close();
      await stagehand.browser.close();
    } catch {
      /* ignore */
    }

    return {
      results: allResults,
      auditTrail,
      sources,
      totalArticlesScanned: allResults.length,
    };
  }
}

// Run standalone if executed directly
const isMainModule = process.argv[1]?.includes("adverse-media-screening");
if (isMainModule) {
  const testCompany: CompanyIdentifier = {
    name: process.env.DEMO_COMPANY_NAME || "SAMPLE_ORG Holdings",
    jurisdiction: process.env.DEMO_JURISDICTION || "United Kingdom",
  };

  screenAdverseMedia(testCompany)
    .then((result) => {
      console.log("\n\n" + "=".repeat(60));
      console.log("FULL JSON OUTPUT");
      console.log("=".repeat(60));
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(console.error);
}
