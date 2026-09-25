// Stagehand + Browserbase: Download Apple's Quarterly Financial Statements - See README.md for full documentation

import { Browserbase } from "@browserbasehq/sdk";
import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import "dotenv/config";
import fs from "fs";
import { z } from "zod/v4";
import { setTimeout as sleep } from "node:timers/promises";
import { inspectArchive, validateStatementUrls } from "./archive-validation.js";

async function saveDownloadsWithRetry(bb: Browserbase, sessionId: string, retryForSeconds = 30): Promise<number> {
  if (!Number.isFinite(retryForSeconds) || retryForSeconds <= 0) throw new Error("Download timeout must be positive");
  const deadline = performance.now() + retryForSeconds * 1000;
  let found = new Set<string>();
  while (performance.now() < deadline) {
    const remaining = Math.max(1, deadline - performance.now());
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);
    let payload: Buffer;
    try {
      const response = await bb.sessions.downloads.list(sessionId, { signal: controller.signal, timeout: remaining, maxRetries: 0 });
      payload = Buffer.from(await response.arrayBuffer());
    } finally {
      clearTimeout(timer);
    }
    if (performance.now() >= deadline) break;
    found = inspectArchive(payload);
    console.log(`Verified ${found.size}/4 quarterly PDFs; missing quarters: ${["1", "2", "3", "4"].filter(q => !found.has(q)).join(", ")}`);
    if (found.size === 4) {
      if (performance.now() >= deadline) break;
      fs.writeFileSync("downloaded_files.zip", payload);
      return payload.length;
    }
    await sleep(Math.min(2000, Math.max(0, deadline - performance.now())));
  }
  throw new Error(`Download timeout: verified ${found.size}/4 quarterly PDFs; archive not saved`);
}

async function main(): Promise<void> {
  console.log("Starting Apple Financial Statements Download Automation...");

  console.log("Initializing Browserbase client...");
  const bb: Browserbase = new Browserbase({
    apiKey: process.env.BROWSERBASE_API_KEY as string,
  });

  // V4's browser factory provisions and owns the Stagehand extension. The returned
  // browser exposes its Browserbase session ID for downloads and Live View APIs.
  const browser = await browserbase.launch({
    apiKey: process.env.BROWSERBASE_API_KEY!,
  });
  const sessionId = browser.sessionId;
  if (!sessionId) throw new Error("Browserbase launch did not return a session ID");
  const stagehand: Stagehand = await Stagehand.create({
    browser: browser,
    logging: { level: "error", onLog: console.log },
  });

  try {
    // Initialize browser session to start automation

    console.log("Stagehand initialized successfully!");
    const context = browser.context;
    let page = (await context.pages())[0];

    // The session can be monitored from the Browserbase Sessions dashboard.
    // Avoid printing its signed Live View URL into application logs.
    console.log("Live View is available in the Browserbase Sessions dashboard");

    console.log("Navigating to Apple.com...");
    await page.goto("https://www.apple.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await stagehand.act("Click the 'Investors' button at the bottom of the page");
    await stagehand.act("Scroll down to the Financial Data section of the page");
    await stagehand.act("Under Quarterly Earnings Reports, click on '2025'");
    page = (await context.activePage()) ?? page;

    // Discover the intended documents semantically and keep the actual UI
    // interaction in Stagehand act().
    const { data: statements } = await stagehand.extract(
      "Extract the actual absolute HTTP(S) href URLs of the four FY2025 Financial Statements PDF links, ordered Q4 through Q1.",
      z.object({ statementUrls: z.array(z.string().url()) }),
    );
    const statementUrls = validateStatementUrls(statements.statementUrls);

    console.log("Downloading quarterly financial statements...");
    for (const [index, statementUrl] of statementUrls.entries()) {
      const opened = await stagehand.act(
        `Click the Financial Statements link under Q${4 - index}`,
        { page },
      );
      if (!opened.data.success) {
        // A direct link trigger is the smallest correctness fallback when the
        // semantic click cannot interact with a PDF target.
        await page.evaluate((url: string) => {
          const link = document.createElement("a");
          link.href = url;
          link.target = "_blank";
          document.body.appendChild(link);
          link.click();
          link.remove();
        }, statementUrl);
      }
      await page.waitForTimeout(500);
      console.log(`Triggered FY2025 Q${4 - index} download`);
    }

    // Retrieve all downloads triggered during this session from Browserbase API
    console.log("Retrieving downloads from Browserbase...");
    await saveDownloadsWithRetry(bb, sessionId, 45);
    console.log("Four FY2025 PDF contents verified and archive saved");

    console.log("\nStagehand Metrics:");
    console.log(await stagehand.metrics());
  } catch (error) {
    console.error("Error during automation:", error);
    throw error;
  } finally {
    // Always close session to release resources and clean up
    await stagehand.close().catch((error) => console.warn("Stagehand cleanup warning:", error));
    await browser.close().catch((error) => console.warn("Browser cleanup warning:", error));
    console.log("Session closed successfully");
  }
}

main().catch((err) => {
  console.error("Application error:", err);
  console.error("Common issues:");
  console.error("  - Check .env file has BROWSERBASE_API_KEY");
  console.error("  - Verify internet connection and Apple website accessibility");
  console.error("  - Ensure sufficient timeout for slow-loading pages");
  console.error("Docs: https://docs.stagehand.dev/v4/first-steps/introduction");
  process.exit(1);
});
