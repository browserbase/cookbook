/**
 * One-time setup: Creates a Browserbase context with Gmail logged in.
 * Run this once, log into Gmail manually, then use the context ID in automate.ts
 */

import Browserbase from "@browserbasehq/sdk";
import { chromium } from "playwright-core";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });

  // Create a persistent context
  console.log("📦 Creating Browserbase context...");
  const context = await bb.contexts.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
  });
  console.log(`✅ Context created: ${context.id}`);
  console.log("\n⚠️  Save this context ID in your .env file:");
  console.log(`   BROWSERBASE_CONTEXT_ID=${context.id}\n`);

  // Create a session using this context
  console.log("🌐 Launching browser session...");
  const session = await bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    browserSettings: { context: { id: context.id, persist: true } },
  });

  // Connect to the session
  const browser = await chromium.connectOverCDP(session.connectUrl);
  const page = browser.contexts()[0].pages()[0];

  // Navigate to Gmail
  await page.goto("https://mail.google.com");

  console.log("\n" + "═".repeat(50));
  console.log("🔐 MANUAL STEP REQUIRED");
  console.log("═".repeat(50));
  console.log("\n1. Open the live view URL below");
  console.log("2. Log into your Gmail account");
  console.log("3. Once logged in, press Enter here to save the session\n");
  console.log(`🔗 Live View: https://browserbase.com/sessions/${session.id}\n`);

  // Wait for user to log in
  process.stdin.once("data", async () => {
    console.log("\n💾 Saving context with Gmail session...");
    await browser.close();
    console.log("✅ Done! Your Gmail session is now saved.\n");
    console.log("Add this to your .env file:");
    console.log(`BROWSERBASE_CONTEXT_ID=${context.id}\n`);
    process.exit(0);
  });
}

main().catch(console.error);
