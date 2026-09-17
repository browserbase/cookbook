/**
 * 🤘 Welcome to Stagehand!
 *
 * TO RUN THIS PROJECT:
 * ```
 * npm install
 * npm run start
 * ```
 *
 * To edit config, see `stagehand.config.ts`
 *
 */
import { Page, BrowserContext, Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import chalk from "chalk";
import dotenv from "dotenv";
import { actWithCache, drawObserveOverlay, clearOverlays } from "./utils.js";

dotenv.config();

export async function main({
  page,
  context,
  stagehand,
  LicenseRecord,
}: {
  page: Page; // Base Page
  context: BrowserContext; // Base BrowserContext
  stagehand: Stagehand; // Stagehand instance
  LicenseRecord: Record<string, string>;
}) {
  await page.goto(LicenseRecord.Site);

  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);

  const inputs = (
    await stagehand.observe(
      "Input the first name, last name, and license number into the page: " +
        JSON.stringify(LicenseRecord),
      { page: page },
    )
  ).data;
  console.log(inputs);

  for (const input of inputs) {
    if (input.method == "fill") {
      await stagehand.act(input, { page: page });
    } else {
      // pass
    }
  }

  await stagehand.act("Click the search button", { page: page });

  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);

  const results = (
    await stagehand.extract(
      "Extract ALL the license verification results from the page, including name, license number and status",
      z.object({
        list_of_licenses: z.array(
          z.object({
            name: z.string(),
            license_number: z.string(),
            status: z.string(),
            more_info_url: z.string(),
          }),
        ),
      }),
      { page: page },
    )
  ).data;
  console.log(results);
}
