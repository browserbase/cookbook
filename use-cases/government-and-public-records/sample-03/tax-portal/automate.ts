import { downloadStatement, type SavedStatement } from "./download-statement.ts";
import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { readPortalRequest, retrieveGmailOtp } from "./gmail-otp.ts";
import dotenv from "dotenv";

// Suppress Stagehand debug logs
process.env.DEBUG = "";

dotenv.config();

const GMAIL_URL = "https://mail.google.com";
const CREDENTIALS = {
  username: "demo_agent",
  password: "demo123",
};

function remoteConfiguration(values: Record<string, string | undefined>) {
  const required = ["PORTAL_URL", "BROWSERBASE_CONTEXT_ID", "BROWSERBASE_API_KEY", "BROWSERBASE_PROJECT_ID", "OPENAI_API_KEY"];
  for (const name of required) {
    if (!values[name]?.trim()) throw new Error(`Remote automation requires ${name}; see README setup.`);
  }
  let url: URL;
  try { url = new URL(values.PORTAL_URL!); } catch { throw new Error("PORTAL_URL must be an absolute HTTP(S) origin."); }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("PORTAL_URL must be an HTTP(S) origin without credentials, path, query or fragment.");
  }
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "[::1]" || hostname === "[::]" || /^\[::ffff:7f[0-9a-f]{2}:/i.test(hostname) || hostname === "0.0.0.0" || hostname.startsWith("127.")) {
    throw new Error("PORTAL_URL points to loopback; the remote browser needs a reachable protected portal origin.");
  }
  return { portalUrl: url.origin, contextId: values.BROWSERBASE_CONTEXT_ID!.trim() };
}

async function main() {
  const configuration = remoteConfiguration(process.env);
  const PORTAL_URL = configuration.portalUrl;
  console.log("\n🚀 Starting Sample Organization Tax Portal Automation Demo\n");

  const browserSettings = { context: { id: configuration.contextId, persist: true } };

  const browser = await browserbase.launch({
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    browserSettings,
  });
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

    console.log(
      `Live View: https://www.browserbase.com/sessions/${stagehand.browser.sessionId}`,
    );

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

    // ========== STEP 4: Go to Gmail (same tab) ==========
    console.log("📬 Step 4: Opening Gmail...");
    // We'll return to /verify-otp which is a stable route
    const portalOtpUrl = `${PORTAL_URL}/verify-otp`;
    console.log(`   Will return to: ${portalOtpUrl}`);

    await portalPage.goto(GMAIL_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    console.log("   ✓ Navigated to Gmail");
    await portalPage.waitForTimeout(5000);

    const otpCode = await retrieveGmailOtp(portalPage, request, async query => {
      const result = await stagehand.act(`Search Gmail using exactly this query: ${JSON.stringify(query)}. Leave the search results visible.`, { page: portalPage });
      if (!result.data.success) throw new Error("Gmail search could not be completed.");
    });
    if (typeof otpCode !== "string" || !/^\d{6}$/.test(otpCode)) throw new Error("Invalid OTP candidate.");

    // ========== STEP 7: Go back to Portal OTP page ==========
    console.log("🔙 Step 7: Returning to portal...");
    await portalPage.goto(portalOtpUrl, { waitUntil: "domcontentloaded" });
    await portalPage.waitForTimeout(2000);

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
