import { downloadStatement, type SavedStatement } from "./download-statement.ts";
import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
/**
 * Local test version - runs with LOCAL browser instead of Browserbase
 * Use this to test the flow before running on Browserbase
 */
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { readPortalRequest, retrieveGmailOtp } from "./gmail-otp.ts";
import dotenv from "dotenv";

dotenv.config();

// For local testing, always use localhost (skip ngrok)
const PORTAL_URL = "http://localhost:3000";
const GMAIL_URL = "https://mail.google.com";
const CREDENTIALS = {
  username: "demo_agent",
  password: "demo123",
};

async function main() {
  console.log("\n🚀 Starting Sample Organization Tax Portal Automation (LOCAL TEST)\n");

  const browser = await localBrowser.launch({ headless: false });
  let closeStagehand: (() => Promise<void>) | undefined;
  const failures: unknown[] = [];
  let artifact: SavedStatement | undefined;
  try {
    const stagehand = await Stagehand.create(StagehandCreateOptionsSchema.parse({
      browser,
      model: { modelName: "openai/gpt-4o", apiKey: process.env.OPENAI_API_KEY },
    }));
    closeStagehand = () => stagehand.close();
    const portalPage = (await stagehand.browser.context.activePage())!;
    const context = stagehand.browser.context;

    console.log("🖥️  Running in LOCAL mode - browser will open\n");

    // ========== STEP 1: Navigate to Portal ==========
    console.log("📍 Step 1: Navigating to county tax portal...");
    await portalPage.goto(PORTAL_URL);
    await portalPage.waitForTimeout(1000);

    // ========== STEP 2: Enter Credentials ==========
    console.log("🔑 Step 2: Entering credentials...");
    await stagehand.act(
      `Type "${CREDENTIALS.username}" into the username field`,
    );
    await stagehand.act(
      `Type "${CREDENTIALS.password}" into the password field`,
    );
    await stagehand.act("Click the Sign In button");
    await portalPage.waitForTimeout(1500);

    // ========== STEP 3: Trigger OTP ==========
    console.log("📧 Step 3: Requesting OTP...");
    await stagehand.act("Click the 'Send OTP to Email' button");
    await portalPage.waitForTimeout(2000);
    const request = await readPortalRequest(portalPage, PORTAL_URL);
    console.log("   Email request accepted; inbox delivery pending.");

    // ========== STEP 4: Open Gmail in NEW TAB ==========
    console.log("📬 Step 4: Opening Gmail in new tab...");
    const gmailPage = await context.newPage();
    await gmailPage.goto(GMAIL_URL);
    await gmailPage.waitForTimeout(3000);

    // Switch Stagehand to Gmail tab
    await stagehand.browser.context.setActivePage(gmailPage);

    const otpCode = await retrieveGmailOtp(gmailPage, request, async query => {
      const result = await stagehand.act(`Search Gmail using exactly this query: ${JSON.stringify(query)}. Leave the search results visible.`, { page: gmailPage });
      if (!result.data.success) throw new Error("Gmail search could not be completed.");
    });
    if (typeof otpCode !== "string" || !/^\d{6}$/.test(otpCode)) throw new Error("Invalid OTP candidate.");

    // ========== STEP 7: Switch back to Portal Tab ==========
    console.log("🔙 Step 7: Switching back to portal tab...");
    await stagehand.browser.context.setActivePage(portalPage);
    await portalPage.goto(`${PORTAL_URL}/verify-otp`, { waitUntil: "domcontentloaded" });
    await portalPage.waitForTimeout(500);

    const currentRequest = await readPortalRequest(portalPage, PORTAL_URL);
    if (currentRequest.requestId !== request.requestId) throw new Error("The portal challenge changed during email retrieval.");

    // ========== STEP 8: Enter OTP ==========
    console.log("🔐 Step 8: Entering OTP code...");
    const otpInput = portalPage.locator('input[name="otp"]');
    if (await otpInput.count() !== 1) throw new Error("Expected one OTP input in the portal.");
    await otpInput.fill(otpCode);
    await stagehand.act("Click the 'Verify & Continue' button");
    await portalPage.waitForTimeout(1500);

    artifact = await downloadStatement(portalPage, PORTAL_URL);

  } catch (error) {
    failures.push(error);
  } finally {
    if (closeStagehand) {
      try { await closeStagehand(); } catch (error) { failures.push(error); }
    }
    try { await browser.close(); } catch (error) { failures.push(error); }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "Automation or resource cleanup failed.");
  if (!artifact) throw new Error("No verified statement artifact was produced.");
  console.log(`Saved verified synthetic PDF: ${artifact.path} (${artifact.bytes} bytes, SHA-256 ${artifact.sha256})`);
}

main().catch(() => {
  console.error("Automation failed during startup or cleanup; sensitive details omitted.");
  process.exitCode = 1;
});
