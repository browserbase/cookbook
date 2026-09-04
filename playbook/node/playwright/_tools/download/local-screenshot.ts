/**
 * Run using npx tsx downloads/screenshot.ts
**/

import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";
import dotenv from "dotenv";
dotenv.config();

const bb = new Browserbase({apiKey: process.env.BROWSERBASE_API_KEY!});

async function createSession() {
  const session = await bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
  });
  return session;
}

async function main() {
  const session = await createSession();
  const browser = await chromium.connectOverCDP(session.connectUrl);
  let page;
  try {
    page = browser.contexts()[0]?.pages()[0];
    if (!page) throw new Error("The session has no page");
    await page.goto("https://en.wikipedia.org/wiki/Main_Page", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    const buffer = await page.screenshot({ type: "jpeg", fullPage: true, timeout: 30_000 });
    mkdirSync("downloads/files", { recursive: true });
    writeFileSync("downloads/files/screenshot.jpeg", buffer);
  } finally {
    try {
      await page?.close();
    } finally {
      await browser.close();
    }
  }
  console.log("Screenshot saved to downloads/files/screenshot.jpeg and session closed.");
}

main().catch(() => {
  console.error("Screenshot capture or cleanup failed.");
  process.exitCode = 1;
});
