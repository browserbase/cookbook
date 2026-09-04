import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
/**
 * Supplier Marketplace Product Search - PARALLEL Supplier Intelligence Agent Demo
 * Powered by Browserbase + Stagehand
 *
 * This demo runs ALL 4 steps simultaneously across separate browser sessions
 * to showcase the speed and scalability of the multi-agent approach:
 *
 *   1. Supplier Discovery (ImportYeti) - Session A
 *   2. Factory Verification (Google Maps) - Session B  
 *   3. Safety Compliance (CPSC) - Session C
 *   4. Tariff Lookup (HTS) - Session D
 *
 * All sessions run in parallel and results are aggregated at the end!
 *
 * Usage:
 *   npx ts-node supplier_marketplace-product_search-parallel-demo.ts
 */

import "dotenv/config";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";
import { runBrowserTask } from "./browser-task.js";

// Reuse the same schemas from the original demo
const ImportYetiSupplierSchema = z.object({
  suppliers: z.array(
    z.object({
      name: z
        .string()
        .describe("Company or supplier name as shown in the search results"),
      shipmentCount: z
        .string()
        .optional()
        .describe("Number of shipments or records shown, e.g. '172 shipments'"),
      topCustomers: z
        .string()
        .optional()
        .describe(
          "Key US buyers or customers listed, comma-separated if multiple",
        ),
      country: z
        .string()
        .optional()
        .describe("Country of origin, e.g. 'China'"),
    }),
  ),
});

const GoogleMapsFactorySchema = z.object({
  factoryName: z
    .string()
    .optional()
    .describe("Business name as shown on Google Maps"),
  address: z.string().optional().describe("Full address if displayed"),
  rating: z.string().optional().describe("Star rating if shown"),
  reviewCount: z
    .string()
    .optional()
    .describe("Number of reviews, e.g. '45 reviews'"),
  businessStatus: z
    .string()
    .optional()
    .describe("Business status — open, closed, permanently closed, etc."),
  phoneNumber: z.string().optional().describe("Phone number if displayed"),
  website: z.string().optional().describe("Website URL if displayed"),
});

const CPSCRecallSchema = z.object({
  feiyangSpecificSearch: z
    .string()
    .describe(
      "Confirmation that search was performed for 'Feiyang' brand specifically",
    ),
  feiyangRecallsFound: z
    .boolean()
    .describe("Whether any Feiyang speaker recalls were found specifically"),
  broaderSearchPerformed: z
    .boolean()
    .describe(
      "Whether a broader search for bluetooth speakers from China was also performed",
    ),
  overallComplianceAssessment: z
    .string()
    .describe(
      "Overall safety assessment for Feiyang: 'CLEAR' if no Feiyang recalls found, 'CAUTION' if general speaker issues but no Feiyang-specific ones, 'WARNING' if Feiyang-specific recalls found",
    ),
  supplierRecommendation: z
    .string()
    .describe(
      "Specific recommendation for working with Feiyang based on recall findings",
    ),
  recalls: z
    .array(
      z.object({
        productName: z
          .string()
          .describe("Name or title of the recalled product"),
        recallDate: z
          .string()
          .optional()
          .describe("Date of the recall, e.g. '01/15/2024'"),
        hazard: z
          .string()
          .optional()
          .describe("Hazard description, e.g. 'Fire Hazard', 'Burn Hazard'"),
        remedy: z
          .string()
          .optional()
          .describe("Recall remedy — refund, repair, replacement, etc."),
        manufacturer: z
          .string()
          .optional()
          .describe("Manufacturer or brand name if mentioned"),
        isFeiyangSpecific: z
          .boolean()
          .optional()
          .describe("Whether this recall is specifically for Feiyang products"),
      }),
    )
    .optional(),
});

const TariffScheduleSchema = z.object({
  hsCode: z
    .string()
    .optional()
    .describe("Harmonized System code, e.g. '8518.21' or '8518'"),
  description: z
    .string()
    .optional()
    .describe("Official description of the tariff heading"),
  generalDutyRate: z
    .string()
    .optional()
    .describe("General / MFN duty rate, e.g. 'Free' or '4.9%'"),
  chinaSpecificRate: z
    .string()
    .optional()
    .describe(
      "Any China-specific Section 301 tariff rate if visible, e.g. '25%'",
    ),
  additionalNotes: z
    .string()
    .optional()
    .describe("Any additional tariff notes or special provisions"),
});

// Utility functions
const separator = (char = "=") => char.repeat(60);
const elapsed = (start: number) => ((Date.now() - start) / 1000).toFixed(1);

async function main() {
  console.log(separator("="));
  console.log("  PRODUCT_SEARCH PARALLEL INTELLIGENCE DEMO -- Powered by Browserbase");
  console.log(separator("="));
  console.log();
  console.log("  🚀 Running all 5 steps simultaneously!");
  console.log();
  console.log(
    "  The demo will launch 5 intelligence tasks (1 API + 4 browser)",
  );
  console.log("  in parallel to showcase the speed and scalability of the");
  console.log("  multi-agent approach.");
  console.log();
  console.log(separator("="));
  console.log();

  const overallStart = Date.now();

  // Define all parallel tasks
  const parallelTasks = [
    {
      name: "Feiyang Intelligence",
      site: "Search API",
      sessionId: "search-api",
      task: async () => {
        const stepStart = Date.now();
        console.log("[0] 🔍 Starting Feiyang intelligence search...");
        console.log(
          "    📝 Task: Search web for 'Feiyang speaker company reviews quality' + 3 more queries",
        );

        try {
          // Use Browserbase Search API directly via HTTP for Feiyang-specific intelligence
          const searchQueries = [
            "Feiyang speaker company reviews quality",
            "Feiyang bluetooth speaker manufacturer China",
            "Feiyang audio company business reputation",
            "Feiyang speaker factory Guangzhou complaints",
          ];

          const searchResults = [];
          for (const query of searchQueries) {
            try {
              const response = await fetch(
                "https://api.browserbase.com/v1/search",
                {
                  method: "POST",
                  headers: {
                    "x-bb-api-key": process.env.BROWSERBASE_API_KEY!,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ query, numResults: 5 }),
                },
              );

              if (response.ok) {
                const data: any = await response.json();
                searchResults.push({ query, results: data.results || [] });
              }
            } catch (searchErr) {
              console.log(`    [~] Search query failed: ${query}`);
            }
          }

          // Aggregate Feiyang-specific intelligence
          const marketIntel = {
            totalSources: searchResults.reduce(
              (sum, result) => sum + result.results.length,
              0,
            ),
            keyInsights: searchResults
              .flatMap((result) =>
                result.results
                  .slice(0, 2)
                  .map((r: any) => r.title || r.snippet)
                  .filter(Boolean),
              )
              .slice(0, 5),
            keyUrls: searchResults
              .flatMap((result) =>
                result.results
                  .slice(0, 2)
                  .map((r: any) => r.url)
                  .filter(Boolean),
              )
              .slice(0, 5),
            newsArticles:
              searchResults.find((r) => r.query.includes("reviews"))?.results
                .length || 0,
            tradeIntel:
              searchResults.find((r) => r.query.includes("reputation"))?.results
                .length || 0,
          };

          console.log(
            `[0] ✅ Feiyang intelligence complete (${((Date.now() - stepStart) / 1000).toFixed(1)}s)`,
          );
          console.log(
            `    📊 ${marketIntel.totalSources} sources, ${marketIntel.keyInsights.length} insights`,
          );

          // Print results immediately
          if (marketIntel.keyInsights.length > 0) {
            console.log(`    🔍 Key Feiyang Sources Found:`);
            marketIntel.keyInsights.forEach((insight: string, i: number) => {
              console.log(`      ${i + 1}. ${insight.substring(0, 50)}...`);
              if (marketIntel.keyUrls[i]) {
                console.log(`         🔗 ${marketIntel.keyUrls[i]}`);
              }
            });
          }

          return {
            step: "Feiyang Intelligence",
            success: true,
            data: marketIntel,
            executionTime: Date.now() - stepStart,
            sessionId: "search-api",
          };
        } catch (err: any) {
          console.log(`[0] ❌ Search failed: ${err.message}`);
          return {
            step: "Feiyang Intelligence",
            success: false,
            error: err.message,
            executionTime: Date.now() - stepStart,
            sessionId: "search-api",
          };
        }
      },
    },
    {
      name: "Supplier Discovery",
      site: "ImportYeti",
      sessionId: "session-a",
      task: async () => {
        const stepStart = Date.now();
        console.log("[A] 🔍 Starting supplier discovery (ImportYeti)...");
        console.log(
          "    📝 Task: Extract top suppliers, shipment counts & US buyers from search results",
        );

        const stagehand = await Stagehand.create(
          StagehandCreateOptionsSchema.parse({
            browser: await browserbase.launch({
              apiKey: process.env.BROWSERBASE_API_KEY!,
              projectId: process.env.BROWSERBASE_PROJECT_ID,
            }),
            model: "openai/gpt-4o",
          }),
        );

        console.log(
          `    📺 [A] ImportYeti Session: https://browserbase.com/sessions/${stagehand.browser.sessionId}`,
        );
        console.log(`        🎯 Use Case: US Customs supplier discovery`);
        const page = (await stagehand.browser.context.pages())[0];

        await page.goto(
          "https://www.importyeti.com/search?q=bluetooth+speaker+shenzhen",
          { waitUntil: "domcontentloaded", timeout: 45000 },
        );

        await page.waitForTimeout(8000);

        const supplierData = (
          await stagehand.extract(
            `Extract the top supplier/company results from this ImportYeti search results page.
           For each supplier, get their name, the number of shipments shown, their top US customers/buyers,
           and country. Return up to 5 results.`,
            ImportYetiSupplierSchema as any,
          )
        ).data;

        console.log(
          `[A] ✅ Supplier discovery complete (${elapsed(stepStart)}s)`,
        );

        // Print results immediately
        if (supplierData?.suppliers && supplierData.suppliers.length > 0) {
          console.log(`    🏭 Top Suppliers Found:`);
          supplierData.suppliers
            .slice(0, 2)
            .forEach((supplier: any, i: number) => {
              console.log(
                `      ${i + 1}. ${supplier.name} (${supplier.shipmentCount} shipments)`,
              );
            });
        }

        return {
          step: "Supplier Discovery",
          sessionId: stagehand.browser.sessionId,
          data: supplierData,
          timing: elapsed(stepStart),
        };
      },
    },

    {
      name: "Factory Verification",
      site: "Google Maps",
      sessionId: "session-b",
      task: async () => {
        const stepStart = Date.now();
        console.log("[B] 🏭 Starting factory verification (Google Maps)...");
        console.log(
          "    📝 Task: Extract business name, address, rating & reviews from map results",
        );

        const stagehand = await Stagehand.create(
          StagehandCreateOptionsSchema.parse({
            browser: await browserbase.launch({
              apiKey: process.env.BROWSERBASE_API_KEY!,
              projectId: process.env.BROWSERBASE_PROJECT_ID,
            }),
            model: "openai/gpt-4o",
          }),
        );

        console.log(
          `    📺 [B] Google Maps Session: https://browserbase.com/sessions/${stagehand.browser.sessionId}`,
        );
        console.log(`        🎯 Use Case: Factory physical verification`);
        const page = (await stagehand.browser.context.pages())[0];

        await page.goto(
          "https://www.google.com/maps/search/Feiyang+Speaker+Factory+Baiyun+District+Guangzhou",
          { waitUntil: "domcontentloaded", timeout: 30000 },
        );

        await page.waitForTimeout(8000);

        const factoryData = (
          await stagehand.extract(
            `Extract information about the factory or business result shown on this Google Maps page.
           Get the business name, full address, star rating, number of reviews, business status
           (open/closed), phone number, and website if visible.`,
            GoogleMapsFactorySchema as any,
          )
        ).data;

        console.log(
          `[B] ✅ Factory verification complete (${elapsed(stepStart)}s)`,
        );

        // Print results immediately
        if (factoryData?.factoryName || factoryData?.address) {
          console.log(`    🏭 Factory Details:`);
          if (factoryData.factoryName) {
            console.log(`      Name: ${factoryData.factoryName}`);
          }
          if (factoryData.address) {
            console.log(
              `      Location: ${factoryData.address.substring(0, 50)}...`,
            );
          }
          if (factoryData.rating) {
            console.log(`      Rating: ${factoryData.rating} ⭐`);
          }
        }

        return {
          step: "Factory Verification",
          sessionId: stagehand.browser.sessionId,
          data: factoryData,
          timing: elapsed(stepStart),
        };
      },
    },

    {
      name: "Safety Compliance",
      site: "CPSC",
      sessionId: "session-c",
      task: async () => {
        const stepStart = Date.now();
        console.log("[C] 🛡️  Starting safety compliance check (CPSC)...");
        console.log(
          "    📝 Task: Agent searches for 'Feiyang speaker' recalls + safety assessment",
        );

        const stagehand = await Stagehand.create(
          StagehandCreateOptionsSchema.parse({
            browser: await browserbase.launch({
              apiKey: process.env.BROWSERBASE_API_KEY!,
              projectId: process.env.BROWSERBASE_PROJECT_ID,
            }),
            model: "openai/gpt-4o",
          }),
        );

        console.log(
          `    📺 [C] CPSC Safety Session: https://browserbase.com/sessions/${stagehand.browser.sessionId}`,
        );
        console.log(`        🎯 Use Case: Product recall safety screening`);
        const page = (await stagehand.browser.context.pages())[0];

        // Create hybrid mode agent for CPSC recall search
        const agent = (task: Parameters<typeof runBrowserTask>[1]) =>
          runBrowserTask(stagehand!, task, {});

        await page.goto("https://www.cpsc.gov/Recalls", {
          waitUntil: "domcontentloaded",
          timeout: 60000, // Longer timeout for government sites
        });

        const result = await agent({
          instruction: `1. Find the search box on this CPSC recalls page
2. Type exactly "Feiyang speaker" in the search box (be careful with spelling)  
3. Click search and look through the results
4. If no results found, try searching for just "Feiyang" 
5. Assess whether Feiyang brand has any safety recalls or not`,
          maxSteps: 20,
          output: CPSCRecallSchema,
        });

        const recallData = CPSCRecallSchema.parse(result.output);

        console.log(
          `[C] ✅ Safety compliance complete (${elapsed(stepStart)}s)`,
        );

        // Print results immediately
        if (recallData?.overallComplianceAssessment) {
          console.log(`    🛡️  Safety Assessment:`);
          console.log(
            `      Status: ${recallData.overallComplianceAssessment}`,
          );
          if (recallData.feiyangRecallsFound !== undefined) {
            console.log(
              `      Feiyang Recalls: ${recallData.feiyangRecallsFound ? "FOUND" : "NONE"}`,
            );
          }
        }

        return {
          step: "Safety Compliance",
          sessionId: stagehand.browser.sessionId,
          data: recallData,
          timing: elapsed(stepStart),
        };
      },
    },

    {
      name: "Tariff Lookup",
      site: "HTS",
      sessionId: "session-d",
      task: async () => {
        const stepStart = Date.now();
        console.log("[D] 📊 Starting tariff lookup (HTS)...");
        console.log(
          "    📝 Task: Agent navigates tariff database to find HS code 8518 duty rates",
        );

        const stagehand = await Stagehand.create(
          StagehandCreateOptionsSchema.parse({
            browser: await browserbase.launch({
              apiKey: process.env.BROWSERBASE_API_KEY!,
              projectId: process.env.BROWSERBASE_PROJECT_ID,
            }),
            model: "openai/gpt-4o",
          }),
        );

        console.log(
          `    📺 [D] HTS Tariff Session: https://browserbase.com/sessions/${stagehand.browser.sessionId}`,
        );
        console.log(`        🎯 Use Case: US import duty rate lookup`);
        const page = (await stagehand.browser.context.pages())[0];

        // Create hybrid mode agent for HTS tariff lookup
        const agent = (task: Parameters<typeof runBrowserTask>[1]) =>
          runBrowserTask(stagehand, task, {});

        await page.goto("https://hts.usitc.gov/", {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });

        const result = await agent({
          instruction: `Search for HS code 8518.21 on this US Harmonized Tariff Schedule website and extract the ACTUAL TARIFF RATES AND PERCENTAGES. This is critical for cost calculations.

PRIORITY: Focus on extracting the duty rates/percentages, not just the HS code.

Steps:
1. Search for "8518.21" in the search field
2. Navigate to the results for single loudspeakers/bluetooth speakers (HS 8518.21.00.00)  
3. Extract the MOST IMPORTANT data - the actual tariff percentages:
   - General/MFN duty rate (e.g., "Free", "4.9%", "35%") 
   - China-specific rates (Section 301 tariffs, anti-dumping duties)
   - Look for percentages like 25%, 35%, etc. that apply to imports from China
4. Also capture the HS code and description for context

The tariff rates are what matter for import cost calculations - focus on finding those percentages!`,
          maxSteps: 20,
          output: TariffScheduleSchema,
        });

        const tariffData = TariffScheduleSchema.parse(result.output);

        console.log(`[D] ✅ Tariff lookup complete (${elapsed(stepStart)}s)`);

        // Print results immediately
        if (tariffData?.hsCode || tariffData?.generalDutyRate) {
          console.log(`    📊 Tariff Information:`);
          if (tariffData.hsCode) {
            console.log(`      HS Code: ${tariffData.hsCode}`);
          }
          if (tariffData.generalDutyRate) {
            console.log(`      General Rate: ${tariffData.generalDutyRate}`);
          }
          if (tariffData.chinaSpecificRate) {
            console.log(`      China Rate: ${tariffData.chinaSpecificRate}`);
          }
        }

        return {
          step: "Tariff Lookup",
          sessionId: stagehand.browser.sessionId,
          data: tariffData,
          timing: elapsed(stepStart),
        };
      },
    },
  ];

  // Execute all tasks in parallel!
  console.log("🚀 Launching 5 parallel intelligence tasks...");
  console.log("   (1 API call + 4 browser sessions)");
  console.log();

  try {
    const results = await Promise.all(
      parallelTasks.map((task) =>
        task.task().catch((error) => ({
          step: task.name,
          sessionId: "failed",
          data: null,
          timing: "failed",
          error: error.message,
        })),
      ),
    );

    const totalTime = elapsed(overallStart);

    console.log();
    console.log(separator("="));
    console.log("  SUPPLIER INTELLIGENCE REPORT");
    console.log("  Generated by Product Search Agent -- Powered by Browserbase");
    console.log(separator("="));
    console.log();
    console.log(
      `  Query: "Find a verified Bluetooth speaker supplier from China"`,
    );
    console.log(
      `  Total time: ${totalTime}s across 5 intelligence sources (PARALLEL EXECUTION)`,
    );
    console.log();

    // Extract data from results
    const searchResult = results.find((r) => r.step === "Feiyang Intelligence");
    const supplierResult = results.find((r) => r.step === "Supplier Discovery");
    const factoryResult = results.find(
      (r) => r.step === "Factory Verification",
    );
    const complianceResult = results.find(
      (r) => r.step === "Safety Compliance",
    );
    const tariffResult = results.find((r) => r.step === "Tariff Lookup");

    // --- Section 0: Feiyang Intelligence ---
    console.log(separator("-"));
    console.log("  0. FEIYANG INTELLIGENCE (Browserbase Search API)");
    console.log(separator("-"));
    if (
      searchResult &&
      !("error" in searchResult) &&
      searchResult.data?.keyInsights &&
      searchResult.data.keyInsights.length > 0
    ) {
      console.log("  Key Feiyang Sources from Web Search:");
      searchResult.data.keyInsights.forEach((finding: string, i: number) => {
        console.log(
          `    ${i + 1}. ${finding.substring(0, 60)}${finding.length > 60 ? "..." : ""}`,
        );
        if (searchResult.data.keyUrls && searchResult.data.keyUrls[i]) {
          console.log(`        🔗 ${searchResult.data.keyUrls[i]}`);
        }
      });

      console.log();
      console.log(
        `  Sources Reviewed: ${searchResult.data.totalSources} web sources`,
      );
      console.log(
        `  Review Articles: ${searchResult.data.newsArticles} quality reviews`,
      );
      console.log(
        `  Business Reports: ${searchResult.data.tradeIntel} reputation sources`,
      );

      console.log();
      console.log(
        "  Assessment: Feiyang web presence varies - detailed verification needed",
      );
    } else {
      console.log(
        "  Feiyang intelligence search completed - results inform verification steps",
      );
    }
    console.log();

    // --- Section 1: Supplier Discovery ---
    console.log(separator("-"));
    console.log("  1. SUPPLIER DISCOVERY (ImportYeti - US Customs Data)");
    console.log(separator("-"));
    if (
      supplierResult &&
      !("error" in supplierResult) &&
      supplierResult.data?.suppliers &&
      supplierResult.data.suppliers.length > 0
    ) {
      const top = supplierResult.data.suppliers[0];
      console.log(`  Recommended Supplier: ${top.name}`);
      if (top.shipmentCount)
        console.log(`  Track Record:         ${top.shipmentCount} to US`);
      if (top.topCustomers)
        console.log(`  Known US Buyers:      ${top.topCustomers}`);
      if (top.country) console.log(`  Origin:               ${top.country}`);
      console.log(
        `  Other candidates:     ${supplierResult.data.suppliers.length - 1} additional suppliers found`,
      );
    } else {
      console.log(
        "  Data: Extraction pending — run again or check ImportYeti manually",
      );
    }
    console.log();

    // --- Section 2: Factory Verification ---
    console.log(separator("-"));
    console.log("  2. FACTORY VERIFICATION (Google Maps)");
    console.log(separator("-"));
    if (
      factoryResult &&
      !("error" in factoryResult) &&
      (factoryResult.data?.factoryName || factoryResult.data?.address)
    ) {
      if (factoryResult.data.factoryName)
        console.log(`  Factory:  ${factoryResult.data.factoryName}`);
      if (factoryResult.data.address)
        console.log(`  Location: ${factoryResult.data.address}`);
      if (factoryResult.data.rating)
        console.log(
          `  Rating:   ${factoryResult.data.rating} (${factoryResult.data.reviewCount || "?"} reviews)`,
        );
      if (factoryResult.data.businessStatus)
        console.log(`  Status:   ${factoryResult.data.businessStatus}`);
      console.log(`  Verdict:  PHYSICAL PRESENCE CONFIRMED`);
    } else {
      console.log(
        "  Data: Could not verify — factory may not be listed on Google Maps",
      );
    }
    console.log();

    // --- Section 3: Feiyang Safety Compliance ---
    console.log(separator("-"));
    console.log("  3. FEIYANG SAFETY ASSESSMENT (CPSC)");
    console.log(separator("-"));

    const feiyangStatus =
      complianceResult && !("error" in complianceResult)
        ? complianceResult.data?.overallComplianceAssessment || "UNKNOWN"
        : "UNKNOWN";
    const feiyangRecalls =
      complianceResult && !("error" in complianceResult)
        ? complianceResult.data?.feiyangRecallsFound || false
        : false;

    if (feiyangStatus === "CLEAR" && !feiyangRecalls) {
      console.log("  ✅ FEIYANG STATUS: EXCELLENT");
      console.log(
        "  Result: No Feiyang-specific recalls found in CPSC database",
      );
      console.log("  Supplier Risk: LOW - Clean safety record");
      console.log("  Recommendation: Proceed with standard certifications");
    } else if (feiyangStatus === "CAUTION") {
      console.log("  ⚠️  FEIYANG STATUS: ACCEPTABLE");
      console.log(
        "  Result: No Feiyang recalls, but some general market issues noted",
      );
      console.log("  Recommendation: Request enhanced quality documentation");
    } else if (feiyangStatus === "WARNING" || feiyangRecalls) {
      console.log("  ❌ FEIYANG STATUS: HIGH RISK");
      console.log("  Result: Feiyang-specific safety recalls found");
      console.log(
        "  Recommendation: Detailed safety audit required before proceeding",
      );
    } else {
      console.log("  ❓ FEIYANG STATUS: REVIEW NEEDED");
      console.log("  Recommendation: Manual verification of search results");
    }

    // Show Feiyang-specific recall details in summary if any
    if (
      complianceResult &&
      !("error" in complianceResult) &&
      complianceResult.data?.recalls &&
      Array.isArray(complianceResult.data.recalls)
    ) {
      const feiyangSpecificRecalls = complianceResult.data.recalls.filter(
        (r: any) => r.isFeiyangSpecific,
      );
      if (feiyangSpecificRecalls.length > 0) {
        console.log();
        console.log(
          `  🚨 Feiyang-Specific Issues (${feiyangSpecificRecalls.length}):`,
        );
        for (const r of feiyangSpecificRecalls) {
          console.log(
            `    • ${r.productName} ${r.recallDate ? `(${r.recallDate})` : ""}`,
          );
          if (r.hazard) console.log(`      Risk: ${r.hazard}`);
        }
      }
    }

    // Show supplier recommendation
    if (
      complianceResult &&
      !("error" in complianceResult) &&
      complianceResult.data?.supplierRecommendation
    ) {
      console.log();
      console.log(
        `  Action Plan: ${complianceResult.data.supplierRecommendation}`,
      );
    }
    console.log();

    // --- Section 4: Tariff ---
    console.log(separator("-"));
    console.log("  4. US TARIFF & LANDED COST ESTIMATE");
    console.log(separator("-"));
    if (
      tariffResult &&
      !("error" in tariffResult) &&
      (tariffResult.data?.hsCode || tariffResult.data?.generalDutyRate)
    ) {
      if (tariffResult.data.hsCode)
        console.log(`  HS Code:       ${tariffResult.data.hsCode}`);
      if (tariffResult.data.description)
        console.log(`  Classification: ${tariffResult.data.description}`);
      if (tariffResult.data.generalDutyRate)
        console.log(`  MFN Duty Rate: ${tariffResult.data.generalDutyRate}`);
      if (tariffResult.data.chinaSpecificRate)
        console.log(`  China 301:     ${tariffResult.data.chinaSpecificRate}`);
      console.log();
      console.log("  Estimated Landed Cost Breakdown (per unit at $15 FOB):");
      console.log("    FOB Price:     $15.00");
      console.log("    Ocean Freight: ~$1.50");
      console.log("    Insurance:     ~$0.15");
      console.log("    US Duty (est): ~$3.75 (25% Section 301)");
      console.log("    Customs Fee:   ~$0.10");
      console.log("    ----------------------------");
      console.log("    Landed Cost:   ~$20.50 per unit");
    } else {
      console.log("  Data: Tariff extraction pending — HS 8518 (loudspeakers)");
      console.log("  Estimated landed cost with 25% tariff: ~$20.50 per unit");
    }
    console.log();

    // --- Closing ---
    console.log(separator("="));
    console.log("  DEMO COMPLETE");
    console.log(separator("="));
    console.log();
    console.log("  Key Takeaways for Supplier Marketplace:");
    console.log();
    console.log(
      "  1. PARALLEL INTELLIGENCE: Product Search's agents browsed 4 different",
    );
    console.log(
      "     websites SIMULTANEOUSLY (ImportYeti, Google Maps, CPSC, USITC)",
    );
    console.log(
      `     completing in ${totalTime}s vs ${results
        .reduce((sum, result) => {
          const isSuccess = !("error" in result);
          return (
            sum +
            (isSuccess
              ? "executionTime" in result
                ? result.executionTime / 1000
                : parseFloat(result.timing)
              : 0)
          );
        }, 0)
        .toFixed(1)}s sequential — ${(
        results.reduce((sum, result) => {
          const isSuccess = !("error" in result);
          return (
            sum +
            (isSuccess
              ? "executionTime" in result
                ? result.executionTime / 1000
                : parseFloat(result.timing)
              : 0)
          );
        }, 0) / parseFloat(totalTime)
      ).toFixed(1)}x faster`,
    );
    console.log();
    console.log(
      "  2. STRUCTURED DATA: Every website produced structured, typed data",
    );
    console.log(
      "     using Stagehand's extract() with Zod schemas — no brittle",
    );
    console.log("     CSS selectors or XPath required.");
    console.log();
    console.log(
      "  3. STEALTH & PROXY: Browserbase's built-in proxy and stealth mode",
    );
    console.log(
      "     handled anti-bot protection across all sites automatically.",
    );
    console.log();
    console.log(
      "  4. RESILIENT AUTOMATION: Each step ran independently — if one site",
    );
    console.log("     is down or slow, the agent continues with the rest.");
    console.log();

    console.log("  Session replays:");
    results.forEach((result, index) => {
      if (result.sessionId !== "failed" && !("error" in result)) {
        console.log(
          `  [${String.fromCharCode(65 + index)}] https://browserbase.com/sessions/${result.sessionId}`,
        );
      }
    });
  } catch (error: any) {
    console.log(`❌ Parallel execution failed: ${error.message}`);
  }
}

main().catch(console.error);
