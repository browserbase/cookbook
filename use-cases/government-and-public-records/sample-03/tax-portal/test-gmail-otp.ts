import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
/**
 * Test script - just tests Gmail email opening and OTP extraction
 */
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { readPortalRequest, retrieveGmailOtp } from "./gmail-otp.ts";
import dotenv from "dotenv";

dotenv.config();

const GMAIL_URL = "https://mail.google.com";

async function main() {
  console.log("Testing retrieval for an existing active portal challenge.");
  const portalUrl = new URL(process.env.PORTAL_URL || "");
  if (!["http:", "https:"].includes(portalUrl.protocol) || portalUrl.username || portalUrl.password || portalUrl.pathname !== "/" || portalUrl.search || portalUrl.hash) throw new Error("PORTAL_URL must be a portal origin.");
  if (!process.env.BROWSERBASE_CONTEXT_ID?.trim()) throw new Error("An existing browser context with an active portal challenge is required.");

  const browserSettings = process.env.BROWSERBASE_CONTEXT_ID
    ? { context: { id: process.env.BROWSERBASE_CONTEXT_ID, persist: true } }
    : undefined;

  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await browserbase.launch({
        apiKey: process.env.BROWSERBASE_API_KEY!,
        projectId: process.env.BROWSERBASE_PROJECT_ID,
        ...(browserSettings ? { browserSettings } : undefined),
      }),
      model: { modelName: "openai/gpt-4o", apiKey: process.env.OPENAI_API_KEY },
    }),
  );

  try {
    const page = (await stagehand.browser.context.activePage())!;

    console.log(
      `🔍 Live View: https://browserbase.com/sessions/${stagehand.browser.sessionId || "check-dashboard"}\n`,
    );

    await page.goto(`${portalUrl.origin}/verify-otp`, { waitUntil: "domcontentloaded" });
    const request = await readPortalRequest(page, portalUrl.origin);
    await page.goto(GMAIL_URL, { waitUntil: "domcontentloaded" });
    await retrieveGmailOtp(page, request, async query => {
      const result = await stagehand.act(`Search Gmail using exactly this query: ${JSON.stringify(query)}. Leave the search results visible.`, { page });
      if (!result.data.success) throw new Error("Gmail search could not be completed.");
    });
    console.log("One request-matched code found; value omitted.");

    console.log("✅ Test complete!");
  } catch (error) {
    console.error("Automation failed; sensitive error details omitted.");
    process.exitCode = 1;
  } finally {
    await stagehand.close();
    await stagehand.browser.close();
  }
}

main().catch(() => {
  console.error("Automation failed during startup or cleanup; sensitive details omitted.");
  process.exitCode = 1;
});
