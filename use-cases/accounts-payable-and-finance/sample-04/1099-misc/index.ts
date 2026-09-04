import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";

const FormFieldSchema = z.object({
  boxNumber: z
    .string()
    .describe("Box number on the form, e.g. '1', '2', 'PAYER TIN'"),
  fieldName: z.string().describe("Name/label of the field"),
  dataType: z.enum(["dollar_amount", "text", "tin", "checkbox", "address"]),
  description: z
    .string()
    .optional()
    .describe("Additional description or instructions"),
});

const Form1099MISCSchema = z.object({
  formTitle: z.string(),
  calendarYear: z.string(),
  payerSection: z
    .array(FormFieldSchema)
    .describe("Fields about the payer (issuer)"),
  recipientSection: z
    .array(FormFieldSchema)
    .describe("Fields about the recipient (payee)"),
  incomeBoxes: z
    .array(FormFieldSchema)
    .describe("Numbered income/payment boxes 1-15"),
  stateSection: z
    .array(FormFieldSchema)
    .describe("State tax reporting fields (boxes 16-18)"),
  otherFields: z
    .array(FormFieldSchema)
    .describe("Remaining fields like account number, CORRECTED checkbox"),
});

async function main() {
  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await browserbase.launch({
        apiKey: process.env.BROWSERBASE_API_KEY!,
        projectId: process.env.BROWSERBASE_PROJECT_ID!,
      }),
      model: {
        modelName: "anthropic/claude-sonnet-4-6",
        apiKey: process.env.ANTHROPIC_API_KEY!,
      },
    }),
  );

  const page = (await stagehand.browser.context.activePage())!;

  console.log("Navigating to Tax Platform Help Center...");
  await page.goto("https://docs.tax_platform.com/", {
    waitUntil: "domcontentloaded",
  });

  console.log("Searching for 1099-MISC...");
  await stagehand.act(
    "Click the search box and type '1099-MISC form sample', then press Enter",
  );

  await page.waitForLoadState("networkidle");

  console.log("Finding the 1099-MISC Form Sample result...");
  await stagehand.act(
    "Click the search result titled '1099-MISC Form Sample' from the JD Edwards 1099 Year-End Processing Guide",
  );

  await page.waitForLoadState("networkidle");

  console.log("On page:", await page.url());

  // The sample page shows form images. Navigate to the sibling page that describes
  // the fields (linked in the same guide under chapter 9).
  await stagehand.act(
    "In the left sidebar, click on '9 Understanding Sources of Information for the 1099 Form'",
  );

  await page.waitForLoadState("networkidle");
  console.log("Sources page:", await page.url());

  console.log("Extracting 1099-MISC form fields...");
  const formData = (
    await stagehand.extract(
      `
      Extract all fields required to fill out IRS Form 1099-MISC (Miscellaneous Information).
      The page describes what data populates each box on the form.
      Capture every named box/field including:
      - Payer information fields (name, address, TIN, phone)
      - Recipient information fields (name, address, TIN)
      - All numbered income boxes (1 through 18)
      - The CORRECTED checkbox
      - Account number field
      - Any FATCA checkbox
      For each field include its box number or label, its name, data type, and any description.
    `,
      Form1099MISCSchema,
    )
  ).data;

  console.log("\n=== 1099-MISC Form Fields ===\n");
  console.log(JSON.stringify(formData, null, 2));

  // Summarize for quick reading
  console.log("\n=== FIELD SUMMARY ===\n");
  const allFields = [
    ...formData.payerSection,
    ...formData.recipientSection,
    ...formData.incomeBoxes,
    ...formData.stateSection,
    ...formData.otherFields,
  ];
  for (const field of allFields) {
    const box = field.boxNumber ? `[Box ${field.boxNumber}]` : "        ";
    console.log(`${box.padEnd(12)} ${field.fieldName} (${field.dataType})`);
    if (field.description) {
      console.log(`             → ${field.description}`);
    }
  }

  await stagehand.close();
  await stagehand.browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
