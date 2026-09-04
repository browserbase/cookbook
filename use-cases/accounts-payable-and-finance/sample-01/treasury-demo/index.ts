import { chromium } from "playwright-core";
import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
/**
 * Sample Organization Treasury Automation Demo
 * ==============================
 * Demonstrates how Browserbase + Stagehand can automate the treasury team's
 * daily workflow: downloading bank statements from a bank portal and uploading
 * them to Sample Organization's internal Treasury Management System (TMS).
 *
 * Flow:
 *   1. Log into bank portal (Global Trust Bank)
 *   2. Download monthly bank statements (PDFs)
 *   3. Navigate to Sample Organization TMS
 *   4. Upload downloaded statements for reconciliation
 *   5. Submit and confirm
 *
 * This replaces a manual process that the treasury team does daily, currently
 * requiring ~2,000 ops team members across various repetitive workflows.
 */

import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { Browserbase } from "@browserbasehq/sdk";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

// ─── Configuration ──────────────────────────────────────────────────────────

const BANK_PORTAL_URL =
  process.env.BANK_PORTAL_URL || "http://localhost:3000/bank-portal.html";
const TREASURY_PORTAL_URL =
  process.env.TREASURY_PORTAL_URL ||
  "http://localhost:3000/treasury-portal.html";

// Bank credentials (for the mock portal)
const BANK_USERNAME = process.env.BANK_USERNAME || "sample_org_treasury";
const BANK_PASSWORD = process.env.BANK_PASSWORD || "demo2024";

// Download directory
const DOWNLOAD_DIR = path.resolve(process.cwd(), "downloads");

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(step: string, message: string) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n[${timestamp}] 🔹 STEP: ${step}`);
  console.log(`   ${message}`);
}

function success(message: string) {
  console.log(`   ✅ ${message}`);
}

function divider(title: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(60)}`);
}

export function validateCloudPortalUrls(portals: Record<string, string>): void {
  for (const [name, value] of Object.entries(portals)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`${name} must be a valid URL`);
    }
    if (url.protocol !== "https:") {
      throw new Error(`${name} must use HTTPS in Browserbase cloud mode`);
    }
    if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) {
      throw new Error(
        `${name} must be publicly reachable in Browserbase cloud mode; use --local for the bundled portals`,
      );
    }
  }
}

export function requireSuccessfulAction(
  instruction: string,
  action: { data: { success: boolean; message?: string } },
): void {
  if (action.data.success !== true) {
    throw new Error(
      `Action failed: ${instruction}${action.data.message ? `: ${action.data.message}` : ""}`,
    );
  }
}

export function validateReconciliation(
  downloadedFiles: string[],
  uploadedFiles: string[],
  confirmation: { isSuccess: boolean; message: string; submittedCount: number },
): void {
  if (downloadedFiles.length === 0) {
    throw new Error("No statements were downloaded in this run");
  }
  if (
    uploadedFiles.length !== downloadedFiles.length ||
    uploadedFiles.some((file, index) => file !== downloadedFiles[index])
  ) {
    throw new Error("The uploaded statements do not match this run's downloads");
  }
  if (!confirmation.isSuccess || !confirmation.message.trim()) {
    throw new Error(
      `Treasury portal did not confirm reconciliation${confirmation.message ? `: ${confirmation.message}` : ""}`,
    );
  }
  if (confirmation.submittedCount !== uploadedFiles.length) {
    throw new Error(
      `Treasury portal confirmed ${confirmation.submittedCount} statements, expected ${uploadedFiles.length}`,
    );
  }
}

// ─── Main Demo ──────────────────────────────────────────────────────────────

async function main() {
  divider("🏦 SAMPLE_ORG TREASURY AUTOMATION DEMO");
  console.log("\n  Automating: Bank Statement Download → Treasury Upload");
  console.log("  Powered by: Browserbase + Stagehand\n");

  // Ensure downloads directory exists
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  }

  // ─── Initialize Browserbase ───────────────────────────────────────────

  // Use --local flag to force local mode even when BROWSERBASE keys are present
  const forceLocal = process.argv.includes("--local");
  const useBrowserbase =
    !forceLocal && process.env.BROWSERBASE_API_KEY ? true : false;

  if (useBrowserbase) {
    validateCloudPortalUrls({ BANK_PORTAL_URL, TREASURY_PORTAL_URL });
  }

  console.log(
    `  Mode: ${useBrowserbase ? "☁️  Browserbase Cloud" : "🖥️  Local Browser"}\n`,
  );

  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await ((useBrowserbase ? "BROWSERBASE" : "LOCAL") === "LOCAL"
        ? localBrowser.launch(
            useBrowserbase
              ? undefined
              : {
                  headless: false,
                  downloadsPath: DOWNLOAD_DIR,
                },
          )
        : browserbase.launch({
            apiKey: process.env.BROWSERBASE_API_KEY!,
            projectId: process.env.BROWSERBASE_PROJECT_ID,
            ...(useBrowserbase
              ? {
                  browserSettings: {
                    advancedStealth: true,
                    blockAds: true,
                  },
                  proxies: true,
                }
              : undefined),
          })),
      model: {
        modelName:
          process.env.MODEL_NAME || "anthropic/claude-sonnet-4-20250514",
        apiKey:
          process.env.MODEL_API_KEY ||
          process.env.ANTHROPIC_API_KEY ||
          process.env.GOOGLE_API_KEY,
      },
      cache: true,
    }),
  );

  const page = (await stagehand.browser.context.activePage())!;

  if (useBrowserbase) {
    const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });
    const debugUrls = await bb.sessions.debug(stagehand.browser.sessionId!);
    console.log(`\n  🔍 Live Session: ${debugUrls.debuggerFullscreenUrl}`);
    console.log(`  📹 Session ID: ${stagehand.browser.sessionId}\n`);
  }

  try {
    // ═════════════════════════════════════════════════════════════════════
    // PHASE 1: Bank Portal — Login & Download Statements
    // ═════════════════════════════════════════════════════════════════════

    divider("📥 PHASE 1: Download Bank Statements");

    // Step 1: Navigate to bank portal
    log("1.1", "Navigating to Global Trust Bank portal...");
    await page.goto(BANK_PORTAL_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    success("Bank portal loaded");

    // Step 2: Log in
    log("1.2", "Authenticating with bank credentials...");
    const requireAction = async (instruction: string) => {
      const action = await stagehand.act(instruction, { page });
      requireSuccessfulAction(instruction, action);
    };

    await requireAction(`Type "${BANK_USERNAME}" into the username field`);
    await requireAction(`Type "${BANK_PASSWORD}" into the password field`);
    await requireAction("Click the Sign In button");
    await page.waitForTimeout(1500);
    success("Successfully authenticated — Dashboard loaded");

    // Step 3: Extract account information
    log("1.3", "Extracting account summary...");
    const accounts = (
      await stagehand.extract(
        "Extract all bank account information: account names, account numbers, and balances",
        z.object({
          accounts: z.array(
            z.object({
              type: z
                .string()
                .describe("Account type (e.g. Operating, Payroll, Treasury)"),
              name: z.string().describe("Full account name"),
              number: z.string().describe("Account number (masked)"),
              balance: z.string().describe("Available balance with $ symbol"),
            }),
          ),
        }),
        { page: page },
      )
    ).data;

    console.log("\n   📊 Account Summary:");
    for (const acct of accounts.accounts) {
      console.log(
        `      ${acct.type}: ${acct.name} (${acct.number}) — ${acct.balance}`,
      );
    }

    // Step 4: Download statements
    log("1.4", "Downloading March 2026 bank statements...");

    const downloadedFiles: string[] = [];

    const connectUrl = stagehand.rpcClient?.browserWebSocketDebuggerUrl;
    if (!connectUrl)
      throw new Error(
        "The browser did not expose its CDP connection for downloads.",
      );
    const downloadBrowser = await chromium.connectOverCDP(connectUrl);
    const downloadPage = downloadBrowser.contexts()[0].pages()[0];
    // Download each March 2026 statement
    const statementButtons = (
      await stagehand.observe(
        "Find all the Download PDF buttons in the statements table for March 2026",
        { page: page },
      )
    ).data;

    console.log(`   Found ${statementButtons.length} statements to download`);

    for (let i = 0; i < Math.min(statementButtons.length, 3); i++) {
      const btn = statementButtons[i];
      log(`1.4.${i + 1}`, `Downloading statement ${i + 1} of 3...`);

      // Set up download listener
      const downloadPromise = downloadPage.waitForEvent("download", {
        timeout: 30000,
      });
      await requireAction(
        `Click the ${i + 1}${i === 0 ? "st" : i === 1 ? "nd" : "rd"} Download PDF button in the March 2026 statements`,
      );

      try {
        const download = await downloadPromise;
        const fileName = download.suggestedFilename();
        const filePath = path.join(DOWNLOAD_DIR, fileName);
        await download.saveAs(filePath);
        downloadedFiles.push(filePath);
        success(`Downloaded: ${fileName}`);
      } catch (error) {
        throw new Error(`Statement ${i + 1} did not produce a download: ${error}`);
      }
    }

    console.log(
      `\n   📁 Downloaded ${downloadedFiles.length} statements to ${DOWNLOAD_DIR}`,
    );

    // ═════════════════════════════════════════════════════════════════════
    // PHASE 2: Treasury Management System — Upload Statements
    // ═════════════════════════════════════════════════════════════════════

    divider("📤 PHASE 2: Upload to Treasury Management System");

    // Step 5: Navigate to Sample Organization TMS
    log("2.1", "Navigating to Sample Organization Treasury Management System...");
    await page.goto(TREASURY_PORTAL_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    success("Sample Organization TMS loaded — Statement Management page");

    // Step 6: Upload statements
    log("2.2", "Uploading bank statements to TMS...");

    // Find the file input and upload
    const fileInput = page.locator('input[type="file"]');

    const filesToUpload = downloadedFiles.filter((filePath) => fs.existsSync(filePath));
    if (filesToUpload.length !== downloadedFiles.length) {
      throw new Error("One or more statements downloaded in this run are missing");
    }

    await fileInput.setInputFiles(filesToUpload);
    await page.waitForTimeout(1500);
    success(`Uploaded ${filesToUpload.length} statements`);

    // Step 7: Submit for processing
    log("2.3", "Submitting statements for reconciliation...");
    await requireAction('Click the "Submit for Processing" button');
    await page.waitForTimeout(2000);
    success("Statements submitted for automated reconciliation");

    // Step 8: Confirm success
    log("2.4", "Verifying submission confirmation...");
    const confirmation = (
      await stagehand.extract(
        "Extract the success message from the confirmation modal/dialog",
        z.object({
          message: z
            .string()
            .describe("The success/confirmation message displayed"),
          isSuccess: z
            .boolean()
            .describe("Whether the submission was successful"),
          submittedCount: z
            .number()
            .int()
            .nonnegative()
            .describe("Number of statements confirmed as submitted"),
        }),
        { page: page },
      )
    ).data;

    validateReconciliation(downloadedFiles, filesToUpload, confirmation);
    success(`Confirmation: "${confirmation.message}"`);

    // Close the modal
    await requireAction('Click the "Done" button');
    await page.waitForTimeout(500);

    // ═════════════════════════════════════════════════════════════════════
    // RESULTS SUMMARY
    // ═════════════════════════════════════════════════════════════════════

    divider("✅ AUTOMATION COMPLETE");

    console.log(`
  📋 Summary:
  ──────────────────────────────────────
  Bank Portal:        Global Trust Bank
  Statements Downloaded:  ${downloadedFiles.length} (this run)
  Treasury System:    Sample Organization TMS
  Statements Uploaded:    ${filesToUpload.length}
  Status:             ✅ Submitted for Reconciliation

  ⏱️  Time Saved:
  ──────────────────────────────────────
  Manual process:     ~15 minutes per run
  Automated:          ~30 seconds

  At 500 runs/week:   125 hours/week saved
  With 2,000 concurrent browsers: Process entire
  month's statements across ALL accounts in minutes.

  🔗 Scale Potential:
  ──────────────────────────────────────
  This same agent can be deployed across:
  • Government document submissions
  • Employee onboarding portals
  • Regulatory compliance filings
  • Payer portal payment processing
  • Any repetitive web-based workflow
`);
  } catch (error) {
    console.error("\n❌ Error during automation:", error);
    throw error;
  } finally {
    await stagehand.close();
    await stagehand.browser.close();
    console.log("\n🏁 Session closed. Demo complete.\n");
  }
}

// ─── Run ────────────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
