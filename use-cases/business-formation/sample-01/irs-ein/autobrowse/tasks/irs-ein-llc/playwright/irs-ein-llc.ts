// Hand-authored from autobrowse run-010's trace (no autobrowse export tool
// available on this machine). Replays the IRS EIN Online Assistant for a
// Single-Member LLC and stops at the Review & Submit page WITHOUT clicking
// "Submit EIN Request".
//
// All PII reads from EIN_* env vars at runtime — no real identifiers are
// committed in this file.
//
// CRITICAL GUARDRAIL — see strategy.md. This script intentionally never
// clicks Submit/Submit Application/Get EIN/Assign EIN/Submit EIN Request.

import { chromium, type Page } from "playwright";
import { z } from "zod";
import "dotenv/config";
import { execFileSync } from "node:child_process";

const OutputSchema = z.object({
  success: z.boolean(),
  stopped_at_step: z.string(),
  stopped_at_url: z.string(),
  next_button_label_at_stop: z.string(),
  fields_completed: z.array(z.string()),
  application_summary: z.object({
    legal_structure: z.string(),
    reason_for_applying: z.string(),
    responsible_party: z.string(),
    business_name: z.string(),
    physical_address: z.string(),
    mailing_address: z.string(),
    phone: z.string(),
    principal_activity: z.string(),
  }),
  guardrail: z.string(),
});
type Output = z.infer<typeof OutputSchema>;

interface BbSession {
  wssUrl: string;
  sessionId: string;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function createBrowserbaseSession(): BbSession | null {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!apiKey || !projectId) return null;

  // No --context-id / --persist — IRS EIN Online Assistant doesn't require
  // login, so a fresh session per run is fine.
  const stdout = execFileSync(
    "bb",
    ["sessions", "create", "--advanced-stealth", "--solve-captchas"],
    { encoding: "utf-8" },
  );
  const session = JSON.parse(stdout);
  const wssUrl = `wss://connect.browserbase.com?apiKey=${apiKey}&sessionId=${session.id}`;
  return { wssUrl, sessionId: session.id };
}

function releaseBrowserbaseSession(bb: BbSession): void {
  try {
    execFileSync(
      "bb",
      ["sessions", "update", bb.sessionId, "--status", "REQUEST_RELEASE"],
      { stdio: "ignore" },
    );
  } catch {
    /* best-effort */
  }
}

// IRS Continue button is a <button>, not an anchor — getByRole('button')
// is required (a:has-text("Continue") matches stray navigation links).
async function clickContinue(page: Page, waitMs = 1500): Promise<void> {
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForLoadState("load");
  await page.waitForTimeout(waitMs);
}

// IRS form's dropdowns are a custom UI widget (bb-custom-select) layered over
// a hidden native <select>. Playwright's selectOption() can't reach the
// hidden select via getByLabel (which returns the visible combobox span).
// Locate the combobox by its label, walk up the DOM until we find the
// associated <select>, then set its value via the React-friendly native
// setter + dispatch input/change events. Accepts either an option value
// (e.g. "CA") or option text (e.g. "January").
async function selectCustom(
  page: Page,
  labelPattern: RegExp | string,
  optionValueOrText: string,
): Promise<void> {
  // getByRole("combobox", { name }) targets the bb-custom-select-opener span
  // specifically — using getByLabel matches help-tip buttons with the same
  // accessible name and breaks the walk-up.
  await page
    .getByRole("combobox", { name: labelPattern })
    .first()
    .evaluate((openerEl, opt) => {
      // The IRS custom-select widget wraps both the visible UI and the
      // hidden native <select>. Find the widget container, not the form root,
      // so we don't accidentally grab a sibling field's <select>.
      const widget = openerEl.closest(
        ".bb-custom-select, [class*='bb-custom-select']:not([class*='opener']):not([class*='panel']):not([class*='label'])",
      ) as HTMLElement | null;
      const searchRoot = widget ?? openerEl.parentElement;
      const select = (searchRoot?.querySelector("select") ??
        null) as HTMLSelectElement | null;
      if (!select) {
        const ancestors: string[] = [];
        let el: Element | null = openerEl;
        for (let i = 0; i < 6 && el; i++) {
          ancestors.push(`${el.tagName}.${String(el.className)}`.slice(0, 100));
          el = el.parentElement;
        }
        throw new Error(
          `No <select> in widget for "${opt}". Widget=${widget?.outerHTML?.slice(0, 200) ?? "null"}. Ancestors: ${ancestors.join(" → ")}`,
        );
      }
      const options = Array.from(select.options);
      const target =
        options.find((o) => o.value === opt) ??
        options.find((o) => o.text.trim() === opt) ??
        options.find(
          (o) => o.text.trim().toLowerCase() === opt.toLowerCase(),
        ) ??
        options.find((o) =>
          o.text.trim().toLowerCase().includes(opt.toLowerCase()),
        );
      if (!target) {
        const dump = options
          .map(
            (o) =>
              `value=${JSON.stringify(o.value)} text=${JSON.stringify(o.text.trim())}`,
          )
          .join(" | ");
        throw new Error(
          `No option matching "${opt}" in <select>. Options: ${dump}`,
        );
      }
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      )!.set!;
      setter.call(select, target.value);
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }, optionValueOrText);
}

async function main(): Promise<Output> {
  // Required PII — fail fast if .env is incomplete.
  const ssn = requireEnv("EIN_RESPONSIBLE_SSN");
  const firstName = requireEnv("EIN_RESPONSIBLE_FIRST_NAME");
  const lastName = requireEnv("EIN_RESPONSIBLE_LAST_NAME");
  const businessName = requireEnv("EIN_BUSINESS_NAME");
  const addressLine1 = requireEnv("EIN_ADDRESS_LINE1");
  const city = requireEnv("EIN_CITY");
  const state = requireEnv("EIN_STATE");
  const zip = requireEnv("EIN_ZIP");
  const county = requireEnv("EIN_COUNTY");
  const phone = requireEnv("EIN_PHONE").replace(/\D/g, "");

  const bb = createBrowserbaseSession();
  const browser = bb
    ? await chromium.connectOverCDP(bb.wssUrl)
    : await chromium.launch({ headless: false });

  const context = bb ? browser.contexts()[0] : await browser.newContext();
  const page = context.pages()[0] ?? (await context.newPage());

  try {
    // ─── Step 1: Legal Structure ──────────────────────────────────────────
    await page.goto("https://sa.www4.irs.gov/applyein/legalStructure");
    await page.waitForLoadState("load");

    console.error("[step1] selecting LLC");
    // IRS form: styled <label> overlays the real radio <input> and intercepts
    // pointer events. force:true is required on every radio click.
    await page.locator("#LLClegalStructureInputid").click({ force: true });
    await page.locator("#membersOfLlcInput").fill("1");
    await page.selectOption("#stateInputControl", state);
    await page
      .getByRole("radio", { name: "Started a new business" })
      .click({ force: true });
    await clickContinue(page);

    // ─── Step 2: Identity ─────────────────────────────────────────────────
    // IRS runs a real-time TIN/name match here. Mock SSNs will be rejected
    // with "We are unable to provide you with an EIN..." — supply real,
    // IRS-registered values in EIN_RESPONSIBLE_* env vars.
    console.error("[step2] filling identity");
    // SSN field has a custom mask — fill() can race the masking widget, so
    // click + keyboard.type (one keystroke per digit) is what reliably works.
    await page.locator("#responsibleSsn").click();
    await page.keyboard.type(ssn);
    await page.locator("#responsibleFirstName").fill(firstName);
    await page.locator("#responsibleLastName").fill(lastName);
    await page.locator("#yesentityRoleRadioInputid").click({ force: true });
    await clickContinue(page);

    // Verify we advanced (not stuck on TIN-match rejection).
    if (!page.url().includes("/addAddresses")) {
      throw new Error(
        `Identity step did not advance. URL=${page.url()}. ` +
          `IRS likely rejected the TIN/name pair — verify EIN_RESPONSIBLE_* values.`,
      );
    }

    // ─── Step 3: Addresses ────────────────────────────────────────────────
    console.error("[step3] filling addresses");
    await page.getByLabel(/^Street/).fill(addressLine1);
    await page.getByLabel(/^City/).fill(city);
    await selectCustom(page, /^State\/U\.S\. territory/, state);
    await page.getByLabel(/^ZIP\/Postal code/).fill(zip);
    await page.getByLabel(/^Phone number/).fill(phone);
    // Mailing-same-as-physical: select "No" for "Do you have an address
    // different from the above where you want your mail to be sent?"
    await page
      .getByRole("group", { name: /Do you have an address different/ })
      .getByRole("radio", { name: "No" })
      .click({ force: true });
    await clickContinue(page);

    // ─── Step 4: Additional Details ───────────────────────────────────────
    console.error("[step4] filling additional details");
    await page.getByLabel(/^Legal name of Single Member/).fill(businessName);
    await page.getByLabel(/^County where Single Member/).fill(county);
    await selectCustom(
      page,
      /^State\/Territory where the Single Member/,
      state,
    );
    await selectCustom(
      page,
      /^State\/Territory where articles of organization/,
      state,
    );
    await selectCustom(page, "Month", "January");
    await page.getByLabel("Year").fill(new Date().getFullYear().toString());

    // Five Yes/No questions — all "No" for software consulting:
    //   1. Owns highway motor vehicle (55,000+ lbs)?
    //   2. Involves gambling/wagering?
    //   3. Needs to file Form 720?
    //   4. Sells/manufactures alcohol, tobacco, firearms?
    //   5. Has W-2 employees expected in next 12 months?
    const noQuestions = [
      /highway motor vehicle/i,
      /gambling.wagering/i,
      /Form 720/i,
      /alcohol.*tobacco.*firearms/i,
      /employees.*next 12 months/i,
    ];
    for (const qre of noQuestions) {
      await page
        .getByRole("group", { name: qre })
        .getByRole("radio", { name: "No" })
        .click({ force: true });
    }
    await clickContinue(page);

    // ─── Step 5a: Activity and Services (3 progressive sub-pages) ─────────
    console.error("[step5a] principal activity → Other");
    await page.getByRole("radio", { name: "Other" }).click({ force: true });
    await page.waitForTimeout(500);

    console.error("[step5b] sub-activity → Consulting");
    await page
      .getByRole("radio", { name: "Consulting" })
      .click({ force: true });
    await clickContinue(page);

    console.error("[step5c] operating advice → Yes");
    await page
      .getByRole("group", { name: /operating advice and assistance/i })
      .getByRole("radio", { name: "Yes" })
      .click({ force: true });
    await clickContinue(page);

    console.error("[step5d] consulting type");
    await page
      .getByLabel(/specify type of consulting/i)
      .fill("Software consulting");
    await clickContinue(page);

    // ─── Step 6: Review & Submit — HARD STOP ──────────────────────────────
    if (!page.url().includes("/reviewAndSubmit")) {
      throw new Error(
        `Expected reviewAndSubmit URL but got ${page.url()}. ` +
          `Form structure may have changed; do NOT click further.`,
      );
    }

    console.error(
      "[step6] reached Review & Submit — capturing screenshot, NOT submitting",
    );
    await page
      .screenshot({ path: "review-submit.png", fullPage: true })
      .catch(() => {});

    // Locate the final submission button label without clicking it.
    const submitLabel = await page
      .getByRole("button", { name: /Submit EIN Request/i })
      .first()
      .textContent()
      .then((t) => (t ?? "").trim());
    if (!submitLabel) {
      throw new Error(
        "Review page loaded, but the final submission control was not observed; refusing to report a successful handoff",
      );
    }

    return OutputSchema.parse({
      success: true,
      stopped_at_step: "Review & Submit (Step 5 of 6)",
      stopped_at_url: page.url(),
      next_button_label_at_stop: submitLabel,
      fields_completed: [
        "Legal Structure: Single-Member LLC, CA, Started a new business",
        "Identity: SSN/name (masked), Owner/member role",
        "Addresses: physical + mailing-same",
        "Additional Details: business name, county, state, start month/year, 5x No",
        "Activity and Services: Other → Consulting → operating advice Yes → Software consulting",
      ],
      application_summary: {
        legal_structure: "Single-Member LLC",
        reason_for_applying: "Started a new business",
        responsible_party: `${firstName} ${lastName} (SSN omitted)`,
        business_name: businessName,
        physical_address: `${addressLine1}, ${city}, ${state} ${zip}`,
        mailing_address: "Same as physical",
        phone,
        principal_activity: "Other / Consulting — Software consulting",
      },
      guardrail:
        "Stopped before final IRS EIN submission — 'Submit EIN Request' button was NOT clicked",
    });
  } finally {
    if (bb) {
      releaseBrowserbaseSession(bb);
    } else {
      await browser.close();
    }
  }
}

main()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 2);
  })
  .catch((err) => {
    console.error("FATAL:", err);
    console.log(JSON.stringify({ success: false, error: String(err) }));
    process.exit(1);
  });
