// Stagehand + Browserbase: Form Filling Automation - See README.md for full documentation

import "dotenv/config";
import { browserbase, Stagehand, type Page } from "@browserbasehq/stagehand";

// Form data variables - using random/fake data for testing
// Set your own variables below to customize the form submission
const firstName = "Alex";
const lastName = "Johnson";
const company = "TechCorp Solutions";
const jobTitle = "Software Developer";
const email = "alex.johnson@example.com";
const message =
  "Hello, I'm interested in learning more about your services and would like to schedule a demo.";

async function fillContactForm(stagehand: Stagehand, page: Page) {
  const fields = [
    { name: "first name", labels: ["first name"], value: firstName },
    { name: "last name", labels: ["last name"], value: lastName },
    { name: "company", labels: ["company"], value: company },
    { name: "job title", labels: ["job title"], value: jobTitle },
    { name: "email", labels: ["email"], value: email },
    { name: "message", labels: ["message", "project"], value: message },
  ];
  const { data: observed } = await stagehand.observe(
    "Find form fields for: first name, last name, company, job title, email, message",
    { page },
  );
  const matches = fields.map((field) => {
    const candidates = observed.filter((action) =>
      field.labels.some((label) => action.description.toLowerCase().includes(label)),
    );
    if (candidates.length !== 1 || !candidates[0].selector) {
      throw new Error(`Expected one observed ${field.name} field`);
    }
    return { ...field, action: candidates[0] };
  });
  if (new Set(matches.map(({ action }) => action.selector)).size !== fields.length) {
    throw new Error("Observed field mappings are ambiguous");
  }
  const { data: helpControls } = await stagehand.observe(
    "Find only the How Can We Help dropdown control, not its options",
    { page },
  );
  if (helpControls.length !== 1 || !helpControls[0].selector) {
    throw new Error("Expected one observed help dropdown");
  }
  const help = page.locator(helpControls[0].selector);
  if (await help.count() !== 1) throw new Error("Help dropdown is not unique");
  for (const { name, action } of matches) {
    if (await page.locator(action.selector).count() !== 1) {
      throw new Error(`The ${name} control is not unique`);
    }
  }
  for (const { name, action, value } of matches) {
    const result = await stagehand.act({ ...action, method: "fill", arguments: [value] }, { page });
    if (result.data.success !== true) throw new Error(`Could not fill ${name}`);
  }
  for (const instruction of [
    "Click on the How Can we help? dropdown",
    "Click on the demo option from the dropdown",
  ]) {
    const result = await stagehand.act(instruction, { page });
    if (result.data.success !== true) throw new Error("Could not select the demo help option");
  }
  for (const { name, action, value } of matches) {
    if (await page.locator(action.selector).inputValue() !== value) {
      throw new Error(`The ${name} value was not confirmed`);
    }
  }
  let selected: string;
  try {
    selected = await help.inputValue();
  } catch {
    selected = await help.innerText();
  }
  if (!/^(?:(?:book|request|schedule) a )?demo$/i.test(selected.trim())) {
    throw new Error("The selected demo help option was not confirmed");
  }
}

async function main() {
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey) throw new Error("BROWSERBASE_API_KEY is required");
  const browser = await browserbase.launch({ apiKey });
  try {
    const stagehand = await Stagehand.create({
      browser,
      model: { modelName: "openai/gpt-4.1" },
      logging: { level: "info" },
    });
    try {
      const page = (await browser.context.pages())[0];
      if (!page) throw new Error("No browser page available");
      await page.goto("https://www.browserbase.com/contact", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await fillContactForm(stagehand, page);
    } finally {
      await stagehand.close();
    }
  } finally {
    await browser.close();
  }
  console.log("Form filled successfully: six values and demo selection verified. Form not submitted.");
}

main().catch((err) => {
  console.error("Error in form filling example:", err);
  console.error("Common issues:");
  console.error("  - Check .env file has BROWSERBASE_API_KEY");
  console.error("  - Ensure form fields are available on the contact page");
  console.error("Docs: https://docs.stagehand.dev/v4/first-steps/introduction");
  process.exit(1);
});
