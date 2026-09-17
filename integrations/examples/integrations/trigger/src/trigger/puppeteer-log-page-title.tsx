import { withBrowser } from "./with-browser";
import { task } from "@trigger.dev/sdk/v3";
import puppeteer from "puppeteer";

export const puppeteerBasicTask = task({
  id: "puppeteer-log-title",
  retry: { maxAttempts: 1 },
  maxDuration: 60,
  run: async () => {
    const browser = await puppeteer.launch();
    return withBrowser(browser, async browser => {
      const page = await browser.newPage();
      await page.setContent("<!doctype html><title>Browserbase cookbook worker check</title><h1>Local browser fixture</h1>", { timeout: 30_000 });
      const title = await page.title();
      if (title !== "Browserbase cookbook worker check") {
        throw new Error("The browser fixture title could not be verified.");
      }
      return { title };
    });
  },
});
