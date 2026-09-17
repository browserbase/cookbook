import { withBrowser } from "./with-browser";
import { logger, task } from "@trigger.dev/sdk/v3";
import puppeteer from "puppeteer-core";

export const puppeteerScrapeWithProxy = task({
  id: "puppeteer-scrape-with-proxy",
  run: async () => {
    const browser = await puppeteer.connect({
      browserWSEndpoint: `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}`,
    });

    return withBrowser(browser, async browser => {
      const page = await browser.newPage();
      // Navigate to the target website
      await page.goto("https://trigger.dev", { waitUntil: "networkidle0" });

      // Scrape the GitHub stars count
      const starCount = await page.evaluate(() => {
        const starElement = document.querySelector(".github-star-count");
        const text = starElement?.textContent ?? "0";
        const numberText = text.replace(/[^0-9]/g, "");
        return parseInt(numberText);
      });

      logger.info("GitHub star count", { starCount });

      return { starCount };
    });
  },
});
