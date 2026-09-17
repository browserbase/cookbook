import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import {
  Stagehand,
  Page,
  BrowserContext,
  browserbase,
  localBrowser,
} from "@browserbasehq/stagehand";
import StagehandConfig from "./stagehand.config.js";
import chalk from "chalk";
import boxen from "boxen";
import {
  drawObserveOverlay,
  clearOverlays,
  actWithCache,
  announce,
} from "./utils.js";
import { z } from "zod";

/**
 * 🤘 Welcome to Stagehand! Thanks so much for trying us out!
 * 🛠️ CONFIGURATION: stagehand.config.ts will help you configure Stagehand
 *
 * 📝 Check out our docs for more fun use cases, like building agents
 * https://docs.stagehand.dev/
 *
 * 💬 If you have any feedback, reach out to us on Slack!
 * https://stagehand.dev/slack
 *
 * 📚 You might also benefit from the docs for Zod, Browserbase, and Playwright:
 * - https://zod.dev/
 * - https://docs.browserbase.com/
 * - https://playwright.dev/docs/intro
 */
async function main({
  page,
  context,
  stagehand,
}: {
  page: Page; // Playwright Page with act, extract, and observe methods
  context: BrowserContext; // Playwright BrowserContext
  stagehand: Stagehand; // Stagehand instance
}) {
  const ticker = "MCD";
  /////////////// YAHOO FINANCE STOCK PRICE ///////////////
  await page.goto("https://finance.yahoo.com/");

  await actWithCache(stagehand, page, `type '${ticker}' into the search box`);
  await actWithCache(stagehand, page, "click the search button");

  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);

  const stock_price = (
    await stagehand.extract(
      "Extract ALL the stock price from the page, including ticker and stock price",
      z.object({
        ticker: z.string(),
        stock_price: z.string(),
      }),
      { page: page },
    )
  ).data;

  announce(JSON.stringify(stock_price));

  // stagehand.log({
  //   category: "create-browser-app",
  //   message: `Metrics`,
  //   auxiliary: {
  //     metrics: {
  //       value: JSON.stringify((await stagehand.metrics())),
  //       type: "object",
  //     },
  //   },
  // });
}

/**
 * This is the main function that runs when you do npm run start
 *
 * YOU PROBABLY DON'T NEED TO MODIFY ANYTHING BELOW THIS POINT!
 *
 */
async function run() {
  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse(await StagehandConfig()),
  );

  if (stagehand.browser.sessionId) {
    console.log(
      boxen(
        `View this session live in your browser: \n${chalk.blue(
          `https://browserbase.com/sessions/${stagehand.browser.sessionId}`,
        )}`,
        {
          title: "Browserbase",
          padding: 1,
          margin: 3,
        },
      ),
    );
  }

  const page = (await stagehand.browser.context.activePage())!;
  const context = stagehand.browser.context;
  await main({
    page,
    context,
    stagehand,
  });
  await stagehand.close();
  await stagehand.browser.close();
  console.log(
    `\n🤘 Thanks so much for using Stagehand! Reach out to us on Slack if you have any feedback: ${chalk.blue(
      "https://stagehand.dev/slack",
    )}\n`,
  );
}

run();
