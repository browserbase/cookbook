import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import "dotenv/config";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";
import { runBrowserTask } from "./browser-task.js";

/**
 * Dynamic Form Validation Demo
 *
 * This demo shows Stagehand's ability to dynamically discover and test
 * form fields — without knowing the form structure in advance.
 *
 * Traditional approach: You need to know every field's selector upfront.
 * Stagehand approach: observe() discovers the form, then act() tests it.
 *
 */

// ── Schema for discovered form fields ───────────────────────────────
const FormFieldSchema = z.object({
  fields: z.array(
    z.object({
      name: z.string().describe("The field label or name"),
      type: z.string().describe("The input type (text, email, select, textarea, etc.)"),
      required: z
        .boolean()
        .optional()
        .describe("Whether the field appears required (omit if unknown)"),
    })
  ),
});

// ── Main demo ───────────────────────────────────────────────────────
async function main() {
  const stagehand = await Stagehand.create(StagehandCreateOptionsSchema.parse({
  browser: await browserbase.launch({ apiKey: process.env.BROWSERBASE_API_KEY! })
  }));



  console.log("\n📝 Dynamic Form Validation Demo");
  console.log(`🔗 Watch live: https://browserbase.com/sessions/${stagehand.browser.sessionId}\n`);

  const page = (await stagehand.browser.context.pages())[0];

  // httpbin's test form — clean HTML, no ads/popups, reliable for AI extraction
  const FORM_URL = "https://httpbin.org/forms/post";
  await page.goto(FORM_URL);

  // ── Step 1: Discover the form structure dynamically ───────────
  console.log("Step 1: Discovering form fields with observe()...\n");

  const formActions = (await stagehand.observe("What form fields and buttons are available on this page?")).data;

  console.log(`  Found ${formActions.length} interactive elements:`);
  for (const action of formActions) {
    console.log(`    → ${action.description}`);
  }

  // Also extract structured form data
  const formStructure = (await stagehand.extract("Extract all form fields on this page, including their labels, input types (text, email, tel, select, radio, checkbox, textarea, etc.), and whether they appear required", FormFieldSchema)).data;

  console.log("\n  Structured form analysis:");
  for (const field of formStructure.fields) {
    const req = field.required === true ? " (required)" : field.required === false ? "" : "";
    console.log(`    • ${field.name} [${field.type}]${req}`);
  }

  // ── Step 2: Test the form with valid input ────────────────────
  console.log("\nStep 2: Testing form with valid input...\n");

  const agent = (task: Parameters<typeof runBrowserTask>[1]) => runBrowserTask(stagehand!, task, {systemPrompt: `You are a QA engineer testing form validation.
Fill out forms methodically and report what happens at each step.
Pay attention to error messages, success indicators, and form behavior.`});

  const validInputResult = await agent({
    instruction: `Test the form on this page:
1. Fill in the customer name field with "John Doe"
2. Fill in the telephone field with "555-123-4567"
3. Fill in the email field with "john@example.com"
4. Select a pizza size (small, medium, or large)
5. Click the submit / order button
6. Observe what happens after submission — does it show a success page, the submitted values, an error, or redirect?`,
    maxSteps: 12,
  });

  console.log("  Valid input test:");
  console.log(`    Success: ${validInputResult.success}`);
  console.log(`    Result: ${validInputResult.message}\n`);

  // ── Step 3: Test with edge cases ──────────────────────────────
  console.log("Step 3: Testing edge cases...\n");

  await page.goto(FORM_URL);

  // Test submitting with empty fields
  const emptyResult = await stagehand.act("Click the submit button without filling in any form fields");
  console.log(`  Empty submission: ${emptyResult.data.success ? "Submitted" : "Blocked"}`);

  // Extract any validation messages
  const validationMessages = (await stagehand.extract("Extract any error messages or validation warnings visible on the page", z.array(z.string().describe("Validation or error message")))).data;

  if (validationMessages.length > 0) {
    console.log("  Validation messages:");
    validationMessages.forEach((msg) => console.log(`    ⚠️  ${msg}`));
  } else {
    console.log("  No validation messages displayed (form may not have client-side validation)");
  }

  // ── Step 4: Test with special characters ──────────────────────
  console.log("\nStep 4: Testing special character handling...\n");

  await page.goto(FORM_URL);

  await stagehand.act("Fill the customer name field with '<script>alert(1)</script>'");
  await stagehand.act("Fill the telephone field with '🎯 555-000-0000'");
  await stagehand.act("Fill the email field with 'test+special@example.com'");
  await stagehand.act("Click the submit or order button");

  const xssResult = (await stagehand.extract("What is shown on the page after form submission? Extract any displayed values or messages.", z.object({
        pageContent: z.string().describe("The main content or result shown"),
        inputsReflected: z.boolean().describe("Whether the submitted values are shown back on the page"),
      }))).data;

  console.log("  Special character test:");
  console.log(`    Inputs reflected: ${xssResult.inputsReflected}`);
  console.log(`    Page shows: ${xssResult.pageContent}\n`);

  // ── Summary ───────────────────────────────────────────────────
  console.log("=".repeat(60));
  console.log("  DYNAMIC FORM TESTING COMPLETE");
  console.log("=".repeat(60));
  console.log(`
What this demo showed:

1. DYNAMIC DISCOVERY — observe() found form fields without any
   hardcoded selectors. Works on any form, anywhere.

2. INTELLIGENT INTERACTION — The agent filled forms, clicked
   buttons, and observed results like a real QA tester.

3. EDGE CASE TESTING — Tested empty submissions, special characters,
   and XSS payloads — all through natural language.

4. STRUCTURED EXTRACTION — Pulled validation messages and form
   state into typed objects for programmatic assertions.

→ New form fields are automatically discovered and tested
→ No selector updates needed when forms change
→ Edge cases (empty fields, special chars) tested naturally
→ Validation logic verified without DOM inspection

Session replay: https://browserbase.com/sessions/${stagehand.browser.sessionId}
`);

  await stagehand.close();
await stagehand.browser.close();
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
