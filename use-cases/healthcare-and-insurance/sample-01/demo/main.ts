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
// import { Page, BrowserContext, Stagehand } from "@browserbasehq/stagehand";
// import { z } from "zod";
// import chalk from "chalk";
// import dotenv from "dotenv";

// dotenv.config();

// export async function main({
//   page,
//   context,
//   stagehand,
// }: {
//   page: Page; // Playwright Page with act, extract, and observe methods
//   context: BrowserContext; // Playwright BrowserContext
//   stagehand: Stagehand; // Stagehand instance
// }) {
//  // Add your code here
//   await page.goto("https://example.invalid/health-portal");

//   await page.waitForSelector('input[autocomplete="email"]', { state: 'visible' });

//   await page.act({
//     action: "fill in the form with %username% and %password% and click the log in button",
//     variables: {
//       username: process.env.HEALTH_PORTAL_USERNAME!,
//       password: process.env.HEALTH_PORTAL_PASSWORD!,
//     },
//   });

//   try {
//     await page.waitForSelector('h1.MuiBox-root', { state: 'visible', timeout: 10000 });
//   } catch (error) {
//       console.log("Element not found within 10 seconds. Reloading the page...");
//       await page.reload(); // Reload the page
//       await page.waitForSelector('h1.MuiBox-root', { state: 'visible' }); // Retry after reload
//   }

//   // add interaction with the page here

// }

import { Page, BrowserContext, Stagehand } from "@browserbasehq/stagehand";
import dotenv from "dotenv";

dotenv.config();

export async function main({
  page,
  context,
  stagehand,
}: {
  page: Page; // Playwright Page with act, extract, and observe methods
  context: BrowserContext; // Playwright BrowserContext
  stagehand: Stagehand; // Stagehand instance
}) {
  try {
    // Navigate to Sample Organization
    await page.goto("https://example.invalid/health-portal");

    // Wait for the email input field to be visible
    await page.waitForSelector('input[autocomplete="email"]', {
      state: "visible",
    });

    // Fill in the form with username and password from environment variables
    const loginResult = await stagehand.act(
      "fill in the form with %username% and %password% and click the log in button",
      {
        page: page,
        variables: {
          username: process.env.HEALTH_PORTAL_USERNAME!,
          password: process.env.HEALTH_PORTAL_PASSWORD!,
        },
      },
    );
    if (loginResult.data.success !== true) {
      throw new Error(
        `Sample Organization login action was unsuccessful${loginResult.data.message ? `: ${loginResult.data.message}` : ""}`,
      );
    }

    // A generic heading also exists on unauthenticated screens. Require a
    // control that is only useful inside an authenticated account instead.
    // Deployments with a different authenticated landmark can provide it
    // explicitly without weakening the default to a generic heading.
    const authenticatedSelector =
      process.env.HEALTH_PORTAL_AUTHENTICATED_SELECTOR ||
      'a[href*="logout" i], button:has-text("Log out"), button:has-text("Sign out")';
    await page.waitForSelector(
      authenticatedSelector,
      { state: "visible", timeout: 10000 },
    );

    if (await page.locator('input[type="password"]').isVisible()) {
      throw new Error("Sample Organization still shows the login form after login");
    }

    await page.waitForTimeout(10000);

    console.log("Successfully logged in to Sample Organization");
  } catch (error) {
    console.error("Test failed:", error);
    throw error;
  }
}
