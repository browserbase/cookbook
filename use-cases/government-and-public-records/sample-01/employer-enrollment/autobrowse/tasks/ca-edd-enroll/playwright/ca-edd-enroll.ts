// California EDD Employer Services Online — autonomous account enrollment
//
// Hand-finalized deterministic Playwright deliverable. Mirrors the flow that
// autobrowse converged on across run-021/22/23 in
// ca-edd-demo/autobrowse/traces/ca-edd-enroll/:
//
//   1. Create a fresh AgentMail inbox (agent owns its email address)
//   2. Open a Verified Browserbase session (residential proxies + captcha solver)
//   3. Navigate the EDD enrollment form: 9 fields → 4 security questions → Submit
//   4. Pick up the activation email from AgentMail, click the link in the same session
//   5. Log in with the just-registered credentials
//   6. Pick up the email OTP, submit it, dismiss the "set up SMS MFA" prompt
//   7. Land on the Employer Services Online dashboard. Done.
//
// Customer-runnable: `npm ci && npm test && npm start`
// (after copying .env.example → .env and opting into account creation).
//
// Why this works against EDD's Akamai bot protection: the Browserbase session is
// created with --verified (Akamai bypass) + --proxies (residential IP rotation)
// + --solve-captchas (Cloudflare-style challenges) + --keep-alive (so the session
// persists across the email-pickup pause). All other automation tooling needs to
// recreate this combination from scratch; here it's one CLI call.

import "dotenv/config";
import { chromium, type Browser, type Page } from "playwright";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import {
  createInbox,
  waitForMessage,
  extractConfirmationLink,
  extractOtpCode,
} from "./agentmail.js";
import { assertEmployerDashboard } from "./outcome.js";

// ─── Config ──────────────────────────────────────────────────────────────────

const LANDING_URL =
  "https://eddservices.mfa.edd.ca.gov/authsvc/mtfim/sps/authsvc?PolicyId=urn:ibm:security:authentication:asf:onpremldap&identity_source_id=627ea49f-d5e8-4997-9e4d-e403f9aa07b8&themeId=default&Target=https%3A%2F%2Feddservices.mfa.edd.ca.gov%2Foidc%2Fendpoint%2Fdefault%2Fauthorize%3Fclient_id%3D4386e72b-3e64-467d-be4b-e47e3013f4a3%26stateId%3Da2af3e43-2932-4abe-8585-7a74f6d82f99%26themeId%3Ddefault";

// Plausible-but-fake PII. EDD does not verify these against any external
// registry during enrollment (only at the per-service step, which we don't
// reach). Use whatever values your demo persona prefers.
const PII = {
  password: "BbDemo2026!",
  firstName: process.env.TEST_FIRST_NAME ?? "Test",
  lastName: process.env.TEST_LAST_NAME ?? "Agent",
  pin: "1234",
  phone: process.env.TEST_PHONE ?? "415-555-0199",
};

const SECURITY_QA: Array<[question: string, answer: string]> = [
  ["What is your favorite movie?", "Avatar"],
  ["What is your favorite food?", "Pizza"],
  ["What is your favorite animal?", "Dog"],
  ["What is the name of your favorite fictional character?", "Superman"],
];

function requireAccountCreationOptIn(): void {
  if (process.env.CA_EDD_ALLOW_ACCOUNT_CREATION !== "true") {
    throw new Error(
      "CA_EDD_ALLOW_ACCOUNT_CREATION must be set to true before this script submits the EDD enrollment form and creates an account record.",
    );
  }
}

// ─── Browserbase session helpers ─────────────────────────────────────────────

interface BbSession {
  wssUrl: string;
  sessionId: string;
}

function createBrowserbaseSession(): BbSession {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!apiKey || !projectId) {
    throw new Error("BROWSERBASE_API_KEY + BROWSERBASE_PROJECT_ID required");
  }

  // --proxies: residential IPs (EDD blocks datacenter ranges)
  // --verified: Akamai bot-bypass (EDD's protection layer)
  // --solve-captchas: handles any inline challenges
  // --keep-alive: session survives between CDP reconnects (we briefly disconnect
  //   while polling AgentMail; without keep-alive the session would auto-close)
  const stdout = execFileSync(
    "browse",
    [
      "cloud",
      "sessions",
      "create",
      "--proxies",
      "--verified",
      "--solve-captchas",
      "--keep-alive",
    ],
    { encoding: "utf-8" },
  );
  // The browse CLI prepends a one-line "Update available" notice before the JSON.
  const idx = stdout.indexOf("{");
  const session = JSON.parse(stdout.slice(idx)) as {
    id: string;
    connectUrl?: string;
  };
  const wssUrl =
    session.connectUrl ??
    `wss://connect.browserbase.com?apiKey=${apiKey}&sessionId=${session.id}`;
  return { wssUrl, sessionId: session.id };
}

function releaseBrowserbaseSession(bb: BbSession): void {
  try {
    execFileSync(
      "browse",
      [
        "cloud",
        "sessions",
        "update",
        bb.sessionId,
        "--status",
        "REQUEST_RELEASE",
      ],
      { stdio: "ignore" },
    );
  } catch {
    /* best-effort */
  }
}

async function connect(
  bb: BbSession,
): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.connectOverCDP(bb.wssUrl);
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.newPage());
  return { browser, page };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const orchestratorStartMs = Date.now();
  requireAccountCreationOptIn();

  // Randomize username per run so each run creates a distinct EDD record.
  const username = `bbDemo${Math.floor(1000 + Math.random() * 9000)}`;

  const inbox = await createInbox({ clientId: `ca-edd-${Date.now()}` });
  console.log(`[inbox] ${inbox.inboxId}`);
  writeFileSync(".last-inbox.txt", inbox.inboxId);

  const bb = createBrowserbaseSession();
  console.log(`[browserbase] session ${bb.sessionId}`);
  console.log(
    `[browserbase] live view: https://www.browserbase.com/sessions/${bb.sessionId}`,
  );
  console.log(`[creds] username: ${username}`);

  const { page } = await connect(bb);

  try {
    // ─── Phase 1: enrollment form ────────────────────────────────────────────
    await page.goto(LANDING_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForLoadState("load");

    console.log("[phase-1] clicking Enroll");
    await page.locator("#enroll-button").click();
    await page.waitForLoadState("load");
    await page.waitForTimeout(2_000);

    console.log("[phase-1] filling enrollment form");
    await page.locator("#txtUserID").fill(username);
    await page.locator("#txtPassword").fill(PII.password);
    await page.locator("#txtPasswordConfirm").fill(PII.password);
    await page.locator("#txtFirstName").fill(PII.firstName);
    await page.locator("#txtLastName").fill(PII.lastName);
    await page.locator("#txtSSN").fill(PII.pin);
    await page.locator("#txtPrimaryEmail").fill(inbox.inboxId);
    await page.locator("#txtPrimaryEmailConfirm").fill(inbox.inboxId);
    // Phone MUST be xxx-xxx-xxxx with dashes — raw 10 digits triggers a
    // validation error that ALSO silently clears the password fields.
    await page.locator("#txtPhoneNum").fill(PII.phone);

    console.log("[phase-1] clicking Next");
    await page.getByRole("button", { name: "Next" }).first().click();
    await page.waitForLoadState("load");
    await page.waitForTimeout(2_000);

    // Akamai bot-management is active on edd.ca.gov. Verified mode bypasses it
    // ~70% of the time on the Next POST; the other ~30% gets an "Access Denied"
    // page. Detect it early and fail with a clear message rather than waiting
    // 30s for a select to appear that never will.
    await assertNotBotBlocked(page);

    // Phase 1.5: Security Questions — 4 native <select> elements, each followed
    // in DOM order by an <input type="text"> for the answer.
    // The "*Answer" <label> isn't programmatically associated with its input
    // (legacy gov form, no `for=`), so neither getByLabel nor an `nth(i)`
    // input index works reliably. XPath sibling traversal from each <select>
    // to its next text input is the stable pairing.
    console.log("[phase-1.5] answering security questions");
    for (let i = 0; i < SECURITY_QA.length; i++) {
      const [q, a] = SECURITY_QA[i];
      const select = page.locator("select").nth(i);
      await select.selectOption({ label: q });
      const answer = select.locator('xpath=following::input[@type="text"][1]');
      await answer.fill(a);
    }

    console.log("[phase-1.5] clicking Continue");
    await page.getByRole("button", { name: "Continue" }).first().click();
    await page.waitForLoadState("load");
    await page.waitForTimeout(3_000);

    // Sanity check — Continue can fail silently if a field validation flunks.
    // The Enrollment Summary page title contains "Enrollment Summary".
    const phase17Title = await page.title();
    if (!/Enrollment Summary/i.test(phase17Title)) {
      throw new Error(
        `Expected Enrollment Summary after Continue, got "${phase17Title}" — likely a field validation error on the previous page.`,
      );
    }

    // Phase 1.7: Enrollment Summary — Submit triggers the activation email.
    // (This is NOT a final-finalize button; it just queues the email.)
    console.log("[phase-1.7] clicking Submit on Enrollment Summary");
    const submittedAt = Date.now();
    // The EDD page header embeds a hidden Google Custom Search submit button
    // (aria-hidden=true). A loose `button:has-text("Submit")` resolves to that
    // first — use getByRole with an exact name to scope to actionable buttons.
    await page.getByRole("button", { name: /^Submit$/i }).click();
    await page.waitForLoadState("load");
    await page.waitForTimeout(3_000);

    const phase1Title = await page.title();
    console.log(`[phase-1] stopped at "${phase1Title}" — ${page.url()}`);
    if (
      !/Enrollment Not Yet Complete|Check your email/i.test(
        await page.content(),
      )
    ) {
      throw new Error(
        `Phase 1 did not reach the email-verification screen. Page title: "${phase1Title}"`,
      );
    }

    // ─── Phase 2: email pickup → click activation link → log in ──────────────
    console.log("[inbox] polling AgentMail for activation email...");
    const activationMsg = await waitForMessage({
      inboxId: inbox.inboxId,
      timeoutMs: 180_000,
      sinceMs: submittedAt - 5_000,
      matchFn: (candidate) =>
        !!extractConfirmationLink(candidate, {
          allowedHosts: ["edd.ca.gov"],
        }),
    });
    console.log(`[inbox] received: "${activationMsg.subject}"`);

    const activationLink = extractConfirmationLink(activationMsg, {
      allowedHosts: ["edd.ca.gov"],
    });
    if (!activationLink) {
      throw new Error(
        `No EDD activation link found in message ${activationMsg.messageId}`,
      );
    }
    console.log(`[link] ${activationLink}`);

    await page.goto(activationLink, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForLoadState("load");
    await page.waitForTimeout(2_000);
    console.log(
      `[phase-2] post-activation: "${await page.title()}" — ${page.url()}`,
    );

    // The activation page shows an "Employer Services Online" link that lands on
    // the public index, NOT on the login form. To reach the actual MFA login,
    // we click a service link from the index, which triggers an SSO redirect
    // through IBM Security Verify.
    console.log("[phase-2] clicking 'Employer Services Online'");
    await page
      .getByRole("link", { name: /Employer Services Online/i })
      .first()
      .click();
    await page.waitForLoadState("load");
    await page.waitForTimeout(2_000);

    console.log(
      "[phase-2] bouncing through e-Services for Business to force MFA redirect",
    );
    await page
      .getByRole("link", { name: /e-Services for Business/i })
      .first()
      .click();
    await page.waitForLoadState("load");
    await page.waitForTimeout(3_000);

    console.log(`[phase-2] login page: "${await page.title()}"`);
    await page.locator("#user-name-input").fill(username);
    await page.locator("#password-input").fill(PII.password);
    const loggedInAt = Date.now();
    await page.locator("#login-button").click();
    await page.waitForLoadState("load");
    await page.waitForTimeout(3_000);

    console.log(
      `[phase-2] post-login: "${await page.title()}" — ${page.url()}`,
    );

    // ─── Phase 3: OTP pickup → submit OTP → dismiss MFA-setup → dashboard ────
    console.log("[inbox] polling AgentMail for login OTP...");
    const otpMsg = await waitForMessage({
      inboxId: inbox.inboxId,
      timeoutMs: 120_000,
      pollMs: 4_000,
      sinceMs: loggedInAt - 5_000,
      matchFn: (candidate) => extractOtpCode(candidate, { length: 6 }) !== null,
    });
    console.log(`[inbox] received: "${otpMsg.subject}"`);

    const otpCode = extractOtpCode(otpMsg, { length: 6 });
    if (!otpCode) {
      throw new Error(`No 6-digit OTP found in message ${otpMsg.messageId}`);
    }
    console.log(`[otp] code: ${otpCode}`);

    // The OTP submission page is IBM Security Verify's `macotp` flow.
    // There's one text input on the page — fill it and submit.
    const otpInput = page
      .locator('input[type="text"], input[autocomplete="one-time-code"]')
      .first();
    await otpInput.fill(otpCode);
    await page
      .getByRole("button", { name: /Submit|Verify|Continue/i })
      .first()
      .click();
    await page.waitForLoadState("load");
    await page.waitForTimeout(3_000);

    console.log(`[phase-3] post-OTP: "${await page.title()}" — ${page.url()}`);

    // If we land on the "Set Up Login Verification" page (URL contains
    // LOGIN_MFA_SETUP), click "Use my email instead" to dismiss — this keeps
    // email-OTP as the only registered factor (which is fine, we own the inbox).
    if (/LOGIN_MFA_SETUP/i.test(page.url())) {
      console.log(
        "[phase-3] dismissing 'Set Up Login Verification' via 'Use my email instead'",
      );
      await page
        .getByText(/Use my email instead/i)
        .first()
        .click();
      await page.waitForLoadState("load");
      await page.waitForTimeout(3_000);
    }

    // ─── Done: dashboard reached ─────────────────────────────────────────────
    const finalTitle = await page.title();
    const finalUrl = await page.url();
    await assertEmployerDashboard(page);
    console.log(`[done] "${finalTitle}" — ${finalUrl}`);
    await page.screenshot({ path: "dashboard.png", fullPage: true });

    const elapsedSec = Math.round((Date.now() - orchestratorStartMs) / 1_000);
    console.log(
      JSON.stringify(
        {
          success: true,
          inbox: inbox.inboxId,
          username,
          final_url: finalUrl,
          final_title: finalTitle,
          elapsed_sec: elapsedSec,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    await page
      .screenshot({ path: "failure.png", fullPage: true })
      .catch(() => {});
    console.error("[error]", err);
    console.log(JSON.stringify({ success: false, error: String(err) }));
    process.exitCode = 1;
  } finally {
    releaseBrowserbaseSession(bb);
    // Intentionally NOT deleting the inbox — it stays available for inspection
    // in the AgentMail console. The inbox-id is also saved to .last-inbox.txt.
    console.log(`[inbox] kept ${inbox.inboxId}`);
  }
}

async function assertNotBotBlocked(page: Page): Promise<void> {
  const title = await page.title();
  const url = await page.url();
  if (/Access Denied/i.test(title) || /errors\.edgesuite\.net/i.test(url)) {
    throw new Error(
      `Akamai bot-management blocked the request (Access Denied / errors.edgesuite.net). ` +
        `Verified mode bypass is ~70% effective on EDD — re-run to roll the dice on a fresh proxy IP. ` +
        `URL: ${url}`,
    );
  }
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
