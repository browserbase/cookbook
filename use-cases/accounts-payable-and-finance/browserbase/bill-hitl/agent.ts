/**
 * Human-in-the-Loop Demo — Stagehand Agent
 * ==========================================
 * Demonstrates the pause/resume pattern for BILL's captcha workflow:
 *
 *   1. Agent fills a payment form automatically
 *   2. Agent detects a verification challenge (simulated captcha)
 *   3. Agent PAUSES and tells the human to solve it in the browser
 *   4. Agent WAITS for the human to complete the challenge
 *   5. Agent resumes and extracts the payment confirmation
 *
 * Usage:
 *   Terminal 1: npx tsx serve.ts
 *   Terminal 2: ANTHROPIC_API_KEY=sk-... npx tsx agent.ts
 *
 * The browser opens visibly (headless: false) so you can interact with it.
 */

import {
  Stagehand,
  StagehandCreateOptionsSchema,
  localBrowser,
} from "@browserbasehq/stagehand";
import { z } from "zod";

// ─── Config ─────────────────────────────────────────────────────────────────

const PORTAL_URL = process.env.PORTAL_URL || "http://localhost:3000";

// Simulated payment data — in production these come from your payment system.
// Using Stagehand variables ensures card data NEVER reaches the LLM.
const PAYMENT = {
  invoiceNumber: "INV-2025-0042",
  cardNumber: "4242 4242 4242 1234",
  expiry: "12/26",
  cvv: "987",
  amount: "1,250.00",
  // Post-HITL: accounting metadata the agent fills in after verification
  glCode: "6200-MKTG",
  memo: "Q2 2026 marketing services - Acme Vendor invoice",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(emoji: string, msg: string) {
  console.log(`\n  ${emoji}  ${msg}`);
}

function detail(msg: string) {
  console.log(`      ${msg}`);
}

type ActionOutcome = { data: { success: boolean; message?: string } };
type PaymentConfirmation = {
  confirmationNumber: string;
  invoice: string;
  amount: string;
  status: string;
};
type AccountingRecord = {
  confirmationNumber: string;
  glCode: string;
  memo: string;
  recordId: string;
};

export function requireSuccessfulAction(
  instruction: string,
  action: ActionOutcome,
): void {
  if (action.data.success !== true) {
    throw new Error(
      `Action failed: ${instruction}${action.data.message ? `: ${action.data.message}` : ""}`,
    );
  }
}

function moneyValue(value: string): number {
  const normalized = value.replace(/[^0-9.-]/g, "");
  if (!normalized || !/^-?\d+(?:\.\d+)?$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}

export function validatePaymentConfirmation(
  confirmation: PaymentConfirmation,
  expected: { invoiceNumber: string; amount: string },
): void {
  if (!/^(approved|success|successful|paid)$/i.test(confirmation.status.trim())) {
    throw new Error(`Payment was not approved: ${confirmation.status}`);
  }
  if (!confirmation.confirmationNumber.trim()) {
    throw new Error("Payment confirmation number is missing");
  }
  if (confirmation.invoice.trim() !== expected.invoiceNumber) {
    throw new Error("Payment confirmation references the wrong invoice");
  }
  if (moneyValue(confirmation.amount) !== moneyValue(expected.amount)) {
    throw new Error("Payment confirmation amount does not match the request");
  }
}

export function validateAccountingRecord(
  record: AccountingRecord,
  confirmationNumber: string,
  expected: { glCode: string; memo: string },
): void {
  if (!record.recordId.trim()) throw new Error("Accounting record ID is missing");
  if (record.confirmationNumber.trim() !== confirmationNumber.trim()) {
    throw new Error("Accounting record does not reference the confirmed payment");
  }
  if (record.glCode.trim() !== expected.glCode) {
    throw new Error("Accounting record contains the wrong GL code");
  }
  if (record.memo.trim() !== expected.memo) {
    throw new Error("Accounting record contains the wrong memo");
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const modelName =
    process.env.MODEL_NAME || "anthropic/claude-sonnet-4-5-20250929";
  const modelApiKey = process.env.ANTHROPIC_API_KEY || "";

  if (!modelApiKey) {
    console.error(
      "\n  ❌ ANTHROPIC_API_KEY is required. Set it in your environment.\n",
    );
    process.exit(1);
  }

  console.log("\n" + "─".repeat(60));
  console.log("  Human-in-the-Loop Demo — Agentic Bill Pay");
  console.log("─".repeat(60));
  console.log(`\n  Portal:  ${PORTAL_URL}`);
  console.log(`  Model:   ${modelName}`);
  console.log(`  Mode:    LOCAL (browser will open visibly)`);

  // ── 1. Initialize Stagehand in LOCAL mode ─────────────────────────────────
  //
  // headless: false → the browser window is visible so the human can
  // interact with it when the agent pauses at the verification step.

  log("🚀", "Initializing Stagehand...");

  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await localBrowser.launch({
        headless: false,
      }),
      cache: false,
    }),
  );

  const page = (await stagehand.browser.context.activePage())!;
  log("✅", "Browser launched");

  const requireAction = async (
    instruction: string,
    options: { variables?: Record<string, string> } = {},
  ) => {
    const action = await stagehand.act(instruction, {
      page,
      ...options,
    });
    requireSuccessfulAction(instruction, action);
  };

  try {
    // ── 2. Navigate to the vendor payment portal ────────────────────────────

    log("🌐", "Navigating to AccuPay vendor portal...");
    await page.goto(PORTAL_URL, { waitUntil: "domcontentloaded" });
    // Small delay to let the page fully render
    await page.waitForTimeout(1000);

    // ── 3. Fill the payment form using Stagehand ────────────────────────────
    //
    // Variables protect PII: the LLM sees "%cardNumber%" not "4242..."

    log("📝", "Agent is filling the payment form...");
    detail(
      "(Card number and CVV are protected via Stagehand variables — never sent to LLM)",
    );

    await requireAction("Type %invoiceNumber% into the invoice number field", {
      variables: { invoiceNumber: PAYMENT.invoiceNumber },
    });

    await requireAction("Type %cardNumber% into the card number field", {
      variables: { cardNumber: PAYMENT.cardNumber },
    });

    await requireAction("Type %expiry% into the expiry field", {
      variables: { expiry: PAYMENT.expiry },
    });

    await requireAction("Type %cvv% into the CVV field", {
      variables: { cvv: PAYMENT.cvv },
    });

    await requireAction("Type %amount% into the payment amount field", {
      variables: { amount: PAYMENT.amount },
    });

    log("✅", "Payment form filled");

    // ── 4. Submit the form ──────────────────────────────────────────────────

    log("📤", "Submitting payment...");
    await requireAction("Click the Submit Payment button");
    await page.waitForTimeout(1000);

    // ── 5. Detect the verification challenge ────────────────────────────────
    //
    // Use extract() to check if a captcha/verification step appeared.
    // This is how the agent programmatically detects the challenge.

    log("🔍", "Checking for verification challenge...");

    const pageState = (
      await stagehand.extract(
        "Check the current page. Is there a security verification challenge or captcha that requires human input? Look for a security code, verification code, or captcha image.",
        z.object({
          hasChallenge: z
            .boolean()
            .describe("Whether a verification/captcha challenge is present"),
          challengeType: z
            .string()
            .describe(
              "Type of challenge: 'security_code', 'captcha', 'otp', or 'none'",
            ),
          description: z
            .string()
            .describe(
              "Brief description of what the challenge asks the user to do",
            ),
        }),
        { page: page },
      )
    ).data;

    if (pageState.hasChallenge) {
      // ── 6. PAUSE — Human takes over ─────────────────────────────────────
      //
      // This is the key human-in-the-loop moment.
      //
      // In production (on Browserbase), you would:
      //   1. Call GET /v1/sessions/{id}/debug to get the live URL
      //   2. Send that URL to a Slack channel or internal tool
      //   3. A human opens the URL (or an iframe) and solves the challenge
      //   4. The agent waits for a DOM signal that the challenge is complete
      //
      // Here in local mode, the human just interacts with the visible browser.

      log("🛑", "VERIFICATION CHALLENGE DETECTED");
      detail(`Type: ${pageState.challengeType}`);
      detail(`What to do: ${pageState.description}`);
      console.log("");
      console.log("  ┌─────────────────────────────────────────────────────┐");
      console.log("  │                                                     │");
      console.log("  │   👉 Please solve the challenge in the browser.     │");
      console.log("  │      The agent will resume automatically.           │");
      console.log("  │                                                     │");
      console.log("  │   In production, this URL would be sent to a        │");
      console.log("  │   human via Slack, email, or embedded as an         │");
      console.log("  │   iframe in your app.                               │");
      console.log("  │                                                     │");
      console.log("  └─────────────────────────────────────────────────────┘");
      console.log("");

      // ── TEST MODE — Simulate the human for end-to-end testing ──────────
      // When SIMULATE_HUMAN=true, we use Playwright to read the security
      // code from the DOM and submit it (no real human needed). This is
      // ONLY for testing/CI — in production a real human solves it.
      if (process.env.SIMULATE_HUMAN === "true") {
        log("🤖", "TEST MODE: simulating human (reading code from DOM)...");
        await page.waitForTimeout(1500); // let UI settle
        const code = await page.locator("#security-code").textContent();
        detail(`Read code: ${code}`);
        await page.locator("#verification-input").fill(code || "");
        await page.locator("#verify-button").click();
      } else {
        log("⏳", "Waiting for human to complete verification...");
      }

      // ── 7. WAIT — Block until the confirmation page appears ─────────────
      //
      // We use Playwright's waitForSelector to watch for the #confirmation
      // element, which only appears after the human successfully enters the
      // code and clicks "Verify". This is a clean signal — no polling needed.
      //
      // Timeout: 5 minutes (plenty of time for a human to solve it)

      await page.waitForSelector("#confirmation", {
        state: "visible",
        timeout: 300_000, // 5 minutes
      });

      log("✅", "Verification completed!");
    } else {
      log("ℹ️", "No verification challenge detected — proceeding directly");
    }

    // ── 8. RESUME — Agent extracts confirmation, then takes more actions ─
    //
    // The human solved the challenge. Now the agent takes over again.
    // First it pulls the confirmation, then it performs follow-up actions
    // on the same page (filling out the accounting metadata form).

    log("📋", "Extracting payment confirmation...");
    await page.waitForTimeout(500); // Brief settle

    const confirmation = (
      await stagehand.extract(
        "Extract the payment confirmation details from the success page, including the confirmation/reference number, invoice number, card used, amount paid, and status.",
        z.object({
          confirmationNumber: z
            .string()
            .describe(
              "Payment confirmation or reference number (e.g. PAY-XXXXXXXX)",
            ),
          invoice: z.string().describe("Invoice number"),
          card: z.string().describe("Masked card number"),
          amount: z.string().describe("Amount paid"),
          status: z
            .string()
            .describe("Payment status (e.g. Approved, Success)"),
        }),
        { page: page },
      )
    ).data;

    validatePaymentConfirmation(confirmation, PAYMENT);

    log("✅", `Payment confirmed: ${confirmation.confirmationNumber}`);

    // ── 9. POST-HITL ACTIONS — Agent fills the accounting metadata form ─
    //
    // This is the key piece: after the human verifies, the agent resumes
    // and performs MORE actions. Here the agent fills in GL code + memo
    // on the same page and clicks "Save to Accounting Records".

    log("🤖", "Agent resuming — filling accounting metadata...");

    await requireAction("Type %glCode% into the GL Account Code field", {
      variables: { glCode: PAYMENT.glCode },
    });

    await requireAction("Type %memo% into the Memo or Description field", {
      variables: { memo: PAYMENT.memo },
    });

    log("📤", "Clicking 'Save to Accounting Records'...");
    await requireAction("Click the 'Save to Accounting Records' button");
    await page.waitForTimeout(1000);

    // ── 10. Extract the final record details ──────────────────────────────

    log("📋", "Extracting final accounting record...");

    const finalRecord = (
      await stagehand.extract(
        "Extract the final accounting record details from the 'All Done' page: confirmation number, GL code, memo, and the record ID assigned by the accounting system.",
        z.object({
          confirmationNumber: z
            .string()
            .describe("Payment confirmation number"),
          glCode: z.string().describe("GL account code"),
          memo: z.string().describe("Memo or description"),
          recordId: z
            .string()
            .describe("Accounting record ID (e.g. REC-XXXXX)"),
        }),
        { page: page },
      )
    ).data;

    validateAccountingRecord(finalRecord, confirmation.confirmationNumber, PAYMENT);

    // ── 11. Done — Report results ─────────────────────────────────────────

    console.log("\n" + "─".repeat(60));
    console.log("  ✅ FULL WORKFLOW COMPLETE");
    console.log("─".repeat(60));
    console.log(`\n  Payment (pre-HITL):`);
    console.log(`    Confirmation:  ${confirmation.confirmationNumber}`);
    console.log(`    Invoice:       ${confirmation.invoice}`);
    console.log(`    Card:          ${confirmation.card}`);
    console.log(`    Amount:        ${confirmation.amount}`);
    console.log(`    Status:        ${confirmation.status}`);
    console.log(`\n  Accounting record (post-HITL agent actions):`);
    console.log(`    Record ID:     ${finalRecord.recordId}`);
    console.log(`    GL Code:       ${finalRecord.glCode}`);
    console.log(`    Memo:          ${finalRecord.memo}`);
    console.log("");

    // In production, you'd now:
    //   - Send this confirmation back to your payment system
    //   - Mark the invoice as paid
    //   - Log the transaction for audit
    //   - Close the Browserbase session
  } catch (err: any) {
    if (err.name === "TimeoutError") {
      log("⏰", "Timed out waiting for human verification (5 min limit)");
    } else {
      log("❌", `Error: ${err.message}`);
    }
    throw err;
  } finally {
    log("🔒", "Closing browser...");
    await stagehand.close();
    await stagehand.browser.close();
  }
}

main().catch((err) => {
  console.error(`\n  Fatal: ${err.message}\n`);
  process.exit(1);
});
