import { chromium, type Page } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";
import dotenv from "dotenv";
import { readFile, access } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const fields = ["company", "bankAccount", "payee", "paymentType", "controlAmount", "memo", "addenda", "spendCategory", "quantity", "unitPrice", "costCenter", "fund", "lineOfBusiness", "lineOfBusinessOption", "attachment"] as const;
export type PaymentData = Record<(typeof fields)[number], string>;
export function validateData(value: unknown): PaymentData {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected payment data object");
  const data = value as Record<string, unknown>;
  for (const key of fields) if (typeof data[key] !== "string" || !data[key].trim() || /[\r\n\0]/.test(data[key])) throw new Error(`Missing or invalid payment field: ${key}`);
  return Object.fromEntries(fields.map(key => [key, data[key]])) as PaymentData;
}
function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name}`);
  return value;
}
function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export async function fillPayment(page: Page, data: PaymentData): Promise<void> {
  // fill the form
  // Company
  await page
    .locator('input[data-uxi-element-id="selectinput-56$12373"]')
    .fill(data.company);
  await page.waitForTimeout(1000);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);

  // Click the Bank Account
  await page
    .locator('input[data-uxi-element-id="selectinput-56$12374"]')
    .click();
  await page.waitForTimeout(1000);
  await page
    .locator('div[aria-label="Submenu Bank Account for Ad Hoc Transactions"]')
    .click();
  // Select Credit Card
  await page
    .getByText(data.bankAccount, { exact: true })
    .click();

  // Select Payee
  await page
    .locator('input[data-uxi-element-id="selectinput-56$85472"]')
    .fill(data.payee);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);
  // select the first option
  await page.locator('div[data-automation-id="promptOption"]').click();

  // Click payment type
  await page
    .locator('input[data-uxi-element-id="selectinput-56$12375"]')
    .click();
  await page.waitForTimeout(1000);
  // select Manual
  await page
    .getByText(data.paymentType, { exact: true })
    .click();

  // Total Control Amount
  await page.locator('input[id*="56$12461"]').fill(data.controlAmount);

  // Memo
  await page.locator('input[id*="56$34417"]').fill(data.memo);

  // addenda
  await page.locator('input[id*="56$46596"]').fill(data.addenda);

  // Line item section
  console.log("Filling the line item section");

  // First make sure we're on the Lines tab
  await page.waitForSelector(
    'div[role="tab"]:has-text("Lines"), li:has-text("Lines")',
    { state: "visible" },
  );
  await page.locator(
    'div[role="tab"]:has-text("Lines"), li:has-text("Lines")',
  ).first().click();
  await page.waitForTimeout(1000);

  // Click the Spend Category cell to open the dropdown
  await page
    .locator('tr:visible td:below(:has-text("Spend Category"))')
    .click();
  await page.waitForTimeout(1000);
  console.log("Clicked Spend Category cell");

  await page
    .getByLabel("Spend Category", { exact: true })
    .fill(data.spendCategory);
  await page.getByLabel("Spend Category", { exact: true }).press("Enter");
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${escapeRegExp(data.spendCategory)}$`) })
    .nth(1)
    .click();

  // Quantity
  await page.locator('[id="\\35 6\\$12190-input"]').click();
  await page.locator('[id="\\35 6\\$12190-input"]').fill(data.quantity);
  await page.locator('[id="\\35 6\\$12190-input"]').press("Enter");

  // Unit Price
  await page.locator('[id="\\35 6\\$12192-input"]').click();
  await page.locator('[id="\\35 6\\$12192-input"]').fill(data.unitPrice);
  await page.locator('[id="\\35 6\\$12192-input"]').press("Enter");

  // Cost Center
  await page.getByLabel("*Cost Center").click();
  await page.getByLabel("*Cost Center").fill(data.costCenter);
  await page.getByLabel("*Cost Center").press("Enter");

  // Fund
  await page.getByLabel("*Fund").click();
  await page.getByLabel("*Fund", { exact: true }).fill(data.fund);
  await page.getByLabel("*Fund", { exact: true }).press("Enter");

  // Line of Business
  await page.getByLabel("Line of Business").click();
  await page.getByLabel("Line of Business").fill(data.lineOfBusiness);
  await page.getByLabel("Line of Business", { exact: true }).press("Enter");
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${escapeRegExp(data.lineOfBusinessOption)}$`) })
    .nth(1)
    .click();

  // Attachments
  await page.getByRole("tab", { name: "Attachments" }).click();

  // select file input button
  const fileInput = await page.locator('input[type="file"]');

  await fileInput.setInputFiles(data.attachment);

  // submit the form
  await page.getByRole("button", { name: "Submit" }).click();
  await page.waitForTimeout(5000);

 }

export async function main(): Promise<void> {
  dotenv.config();
  const apiKey = required("BROWSERBASE_API_KEY");
  const username = required("ERP_USERNAME");
  const password = required("ERP_PASSWORD");
  const loginUrl = required("ERP_LOGIN_URL");
  const paymentUrl = required("ERP_PAYMENT_URL");
  for (const value of [loginUrl, paymentUrl]) {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Expected HTTPS ERP platform URLs without credentials");
  }
  const data = validateData(JSON.parse(await readFile(required("PAYMENT_DATA_PATH"), "utf8")));
  await access(data.attachment);
  const bb = new Browserbase({ apiKey });
  const session = await bb.sessions.create({ browserSettings: { verified: true } });
  let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | undefined;
  try {
    browser = await chromium.connectOverCDP(session.connectUrl);
    const context = browser.contexts()[0];
    if (!context) throw new Error("Browser context unavailable");
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(loginUrl);
    await page.getByText("ERP platform Native Login", { exact: true }).click();
    await page.locator("input[aria-label='Username']").fill(username);
    await page.locator("input[aria-label='Password']").fill(password);
    await page.locator("button[type='button'][data-automation-id='goButton']").click();
    await page.waitForTimeout(5000);
    await page.goto(paymentUrl);
    await fillPayment(page, data);
    console.log(`Submit clicked; verify the resulting status in the account. Replay: https://browserbase.com/sessions/${session.id}`);
  } finally {
    try { await browser?.close(); }
    finally { await bb.sessions.update(session.id, { status: "REQUEST_RELEASE" }); }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error("Payment workflow failed; inspect the account before retrying."); process.exitCode = 1; });
}
