import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { Stagehand, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";

import { writeFile, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function main() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("Set OPENAI_API_KEY before running the scraper.");
  let browser;
  let stagehand;
  try {
  browser = await localBrowser.launch({ headless: false });
  stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser,
      model: { modelName: "openai/gpt-4o", apiKey },
    }),
  );

    // Initialize Stagehand
    console.log("Initializing Stagehand...");

    console.log("Stagehand initialized successfully.");

    // Get the page instance
    const page = await stagehand.browser.context.activePage();
    if (!page) {
      throw new Error("Failed to get page instance from Stagehand");
    }

    // Step 1: Navigate to URL
    console.log(
      "Navigating to: https://rates.example.invalid/mortgages/30-year-mortgage-rates/...",
    );
    await page.goto(
      "https://rates.example.invalid/mortgages/30-year-mortgage-rates/?mortgageType=Purchase&partnerId=br3&pid=br3&pointsChanged=false&purchaseDownPayment=224000&purchaseLoanTerms=30yr&purchasePoints=All&purchasePrice=1120000&purchasePropertyType=SingleFamily&purchasePropertyUse=PrimaryResidence&searchChanged=false&ttcid&userCreditScore=780&userDebtToIncomeRatio=0&userFha=false&userVeteranStatus=NoMilitaryService&zipCode=94127",
      { waitUntil: "domcontentloaded" },
    );

    // Step 2: Perform action
    console.log(`Performing action: click the "Skip and show me rates" link`);
    await stagehand.act(`click the "Skip and show me rates" link`, {
      page: page,
    });

    // Wait a moment for content to load
    await page.waitForTimeout(2000);

    // Scroll: Scrolled down 3 pixels
    await page.evaluate(() => window.scrollBy(0, 3));

    // Scroll: Scrolled down 5 pixels
    await page.evaluate(() => window.scrollBy(0, 5));

    // Step 5: Extract data
    console.log("Extracting mortgage lender information...");
    const extractedData = (
      await stagehand.extract(
        `Extract all mortgage lender information from the rates table. For each lender, capture: name, loan type, rate, APR, payment, points, costs, and rating. Include all lenders visible on the page.`,
        z.object({
          lenders: z.array(
            z.object({
              name: z.string().optional(),
              loanType: z.string().optional(),
              rate: z.string().optional(),
              apr: z.string().optional(),
              payment: z.string().optional(),
              points: z.string().optional(),
              costs: z.string().optional(),
              rating: z.string().optional(),
            }),
          ),
        }),
        { page: page },
      )
    ).data;

    const output = resolve("mortgage-rates-results.json");
    const temporary = `${output}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(extractedData, null, 2) + "\n", { flag: "wx", mode: 0o600 });
      await rename(temporary, output);
    } finally {
      await rm(temporary, { force: true });
    }
    console.log("Results saved to mortgage-rates-results.json");
    return extractedData;
  } finally {
    // Attempt both cleanups, including when initialization or extraction fails.
    try {
      await stagehand?.close();
    } finally {
      await browser?.close();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error("Mortgage scraper failed. Check configuration and the run before using any saved results.");
    process.exitCode = 1;
  });
}
