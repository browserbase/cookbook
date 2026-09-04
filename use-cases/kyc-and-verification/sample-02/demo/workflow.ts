import {
  Stagehand,
  browserbase,
  StagehandCreateOptionsSchema,
} from "@browserbasehq/stagehand";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { join } from "path";
import { runBrowserTask } from "./browser-task.js";

// Stagehand configuration for Browserbase
const stagehandConfig = async () => ({
  browser: await browserbase.launch({
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
  }),
  model: {
    modelName: "google/gemini-3.6-flash",
    apiKey: process.env.GOOGLE_API_KEY,
  },
});

interface BusinessInfo {
  ownershipName?: string;
  dbaName?: string;
  businessAccountNumber?: string;
  locationId?: string;
  streetAddress?: string;
  businessStartDate?: string;
  businessEndDate?: string;
  neighborhood?: string;
  naicsCode?: string;
  naicsCodeDescription?: string;
}

interface MCCCode {
  mcc: string;
  editedDescription?: string;
  combinedDescription?: string;
  usdaDescription?: string;
  irsDescription?: string;
  irsReportable?: string;
  reasoning?: string;
}

async function lookupBusinessCodes(businessName: string) {
  let stagehand: Stagehand | null = null;

  try {
    console.log(`\n🔍 Looking up codes for: ${businessName}\n`);

    const allMCCCodes = loadMCCCodesFromCSV();
    for (const name of ["OPENAI_API_KEY", "GOOGLE_API_KEY", "BROWSERBASE_API_KEY", "BROWSERBASE_PROJECT_ID"]) {
      if (!process.env[name]?.trim()) throw new Error(`${name} is required`);
    }

    // Initialize Stagehand
    console.log("⚡ Initializing Stagehand...");
    stagehand = await Stagehand.create(
      StagehandCreateOptionsSchema.parse(await stagehandConfig()),
    );
    const page = (await stagehand.browser.context.activePage())!;
    if (!page) {
      throw new Error("Failed to get page instance");
    }

    // STEP 1: Get NAICS code from SF Business Registry using Agent
    console.log("\n📋 Step 1: Searching SF Business Registry...");
    await page.goto(
      "https://data.sfgov.org/stories/s/Registered-Business-Lookup/k6sk-2y6w/",
    );

    console.log("   🤖 Agent autonomously searching for business...");
    const stagehandAgent = (task: Parameters<typeof runBrowserTask>[1]) =>
      runBrowserTask(stagehand!, task, {
        instructions: "You are a helpful assistant that can use a web browser.",
      });

    const search = await stagehandAgent(
      `Find and look up the business "${businessName}" in the SF Business Registry.
      Use the DBA Name filter to search for "${businessName}", apply the filter, and click on the business row to view detailed information. Scroll towards the right to see the NAICS code.`,
    );

    if (!search.completed) throw new Error("Business registry search did not complete");

    // Extract comprehensive business info after agent completes the search
    console.log("   📊 Extracting business information...");
    const fullBusinessInfo = (
      await stagehand.extract(
        "Extract all visible business information including DBA Name, Ownership Name, Business Account Number, Location Id, Street Address, Business Start Date, Business End Date, Neighborhood, NAICS Code, and NAICS Code Description",
        z.object({
          dbaName: z.string().trim().min(1),
          ownershipName: z.string().optional(),
          businessAccountNumber: z.string().trim().min(1),
          locationId: z.string().optional(),
          streetAddress: z.string().optional(),
          businessStartDate: z.string().optional(),
          businessEndDate: z.string().optional(),
          neighborhood: z.string().optional(),
          naicsCode: z.string().trim().min(1),
          naicsCodeDescription: z.string().optional(),
        }),
        { page: page },
      )
    ).data as BusinessInfo;

    console.log("✅ Business found!");
    console.log(`   DBA Name: ${fullBusinessInfo.dbaName}`);
    console.log(`   Address: ${fullBusinessInfo.streetAddress}`);
    console.log(`   NAICS Code: ${fullBusinessInfo.naicsCode}`);
    console.log(
      `   NAICS Description: ${fullBusinessInfo.naicsCodeDescription}`,
    );

    // STEP 2: Load MCC codes from CSV and determine best matches using LLM
    console.log("\n💳 Step 2: Loading MCC codes from CSV...");
    console.log(`   ✅ Loaded ${allMCCCodes.length} MCC codes from database`);
    console.log("   🤖 Analyzing business to determine best MCC matches...");

    const mccCodes = await determineMCCCodes(fullBusinessInfo, allMCCCodes);

    // STEP 3: Display results
    console.log("\n" + "=".repeat(80));
    console.log("📊 RESULTS SUMMARY");
    console.log("=".repeat(80));

    console.log("\n🏢 BUSINESS INFORMATION:");
    console.log(`   DBA Name: ${fullBusinessInfo.dbaName || "N/A"}`);
    console.log(`   Ownership: ${fullBusinessInfo.ownershipName || "N/A"}`);
    console.log(`   Address: ${fullBusinessInfo.streetAddress || "N/A"}`);
    console.log(`   Neighborhood: ${fullBusinessInfo.neighborhood || "N/A"}`);
    console.log(
      `   Business Account #: ${fullBusinessInfo.businessAccountNumber || "N/A"}`,
    );
    console.log(`   Location ID: ${fullBusinessInfo.locationId || "N/A"}`);
    console.log(
      `   Start Date: ${fullBusinessInfo.businessStartDate || "N/A"}`,
    );
    console.log(`   End Date: ${fullBusinessInfo.businessEndDate || "Active"}`);

    console.log("\n🏷️  NAICS CODE:");
    console.log(`   Code: ${fullBusinessInfo.naicsCode || "N/A"}`);
    console.log(
      `   Description: ${fullBusinessInfo.naicsCodeDescription || "N/A"}`,
    );

    console.log("\n💳 RELEVANT MCC CODES:");
    if (mccCodes.length > 0) {
      mccCodes.forEach((code, idx) => {
        console.log(`\n   ${idx + 1}. MCC ${code.mcc}`);
        console.log(
          `      Description: ${code.editedDescription || code.combinedDescription || "N/A"}`,
        );
        console.log(`      IRS Reportable: ${code.irsReportable || "N/A"}`);
        if (code.reasoning) {
          console.log(`      Reasoning: ${code.reasoning}`);
        }
      });
    } else {
      console.log("   No MCC codes found");
    }

    console.log("\n" + "=".repeat(80));

    return {
      success: true,
      businessInfo: fullBusinessInfo,
      mccCodes: mccCodes,
    };
  } catch (error) {
    console.error("\n❌ Error:", error);
    return { success: false, error };
  } finally {
    if (stagehand) {
      console.log("\n🔒 Closing browser...");
      try { await stagehand.close(); }
      finally { await stagehand.browser.close(); }
    }
  }
}

// Load MCC codes from CSV file
function loadMCCCodesFromCSV(): MCCCode[] {
  const rows: string[][] = parse(readFileSync(join(process.cwd(), "mcc_codes.csv"), "utf-8"), {
    bom: true, skip_empty_lines: true,
  });
  const [header, ...records] = rows;
  const expected = ["mcc", "editeddescription", "combineddescription", "usdadescription", "irsdescription", "irsreportable"];
  const normalized = header?.map(value => value.toLowerCase().replace(/[^a-z]/g, ""));
  if (!normalized || normalized.length !== 6 || expected.some((name, i) => normalized[i] !== name)) {
    throw new Error("MCC CSV must use the documented six-column header order");
  }
  if (!records.length) throw new Error("MCC reference contains no records");
  const seen = new Set<string>();
  return records.map(row => {
    const [mcc, editedDescription, combinedDescription, usdaDescription, irsDescription, irsReportable] = row.map(value => value.trim());
    if (!/^\d{4}$/.test(mcc) || seen.has(mcc) || ![editedDescription, combinedDescription, usdaDescription, irsDescription].some(Boolean)) {
      throw new Error("MCC reference contains an invalid or duplicate record");
    }
    seen.add(mcc);
    return { mcc, editedDescription, combinedDescription, usdaDescription, irsDescription, irsReportable };
  });
}

// Determine MCC codes using LLM with reference data
async function determineMCCCodes(
  businessInfo: BusinessInfo,
  mccDatabase: MCCCode[],
): Promise<MCCCode[]> {
  {
    if (!mccDatabase.length) throw new Error("MCC reference is empty");
    if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY is required");
    // Supply the complete validated reference.
    const mccList = mccDatabase
      .map(
        (code) =>
          `${code.mcc}: ${code.editedDescription || code.combinedDescription || "N/A"} (IRS: ${code.irsReportable || "N/A"})`,
      )
      .join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert in Merchant Category Codes (MCC). Given a business and a list of available MCC codes, select the 1-3 most appropriate codes that match the business type.

Analyze the business information carefully and match it against the provided MCC code database. Return your selections with reasoning.`,
          },
          {
            role: "user",
            content: `Business Information:
- DBA Name: ${businessInfo.dbaName || "N/A"}
- Ownership: ${businessInfo.ownershipName || "N/A"}
- Address: ${businessInfo.streetAddress || "N/A"}
- Neighborhood: ${businessInfo.neighborhood || "N/A"}
- NAICS Code: ${businessInfo.naicsCode || "N/A"}
- NAICS Description: ${businessInfo.naicsCodeDescription || "N/A"}
- Business Start Date: ${businessInfo.businessStartDate || "N/A"}

Available MCC Codes:
${mccList}

Based on the business information above, select the 1-3 most appropriate MCC codes from the list. Return a JSON array in this exact format:
[
  {
    "mcc": "5812",
    "editedDescription": "Eating Places, Restaurants",
    "irsReportable": "Yes",
    "reasoning": "Brief explanation why this MCC code matches this business"
  }
]

Return [] if no reference code fits. Return ONLY the JSON array, no other text.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!response.ok) throw new Error(`MCC classifier request failed (HTTP ${response.status})`);
    const data = z
      .object({
        choices: z.array(
          z.object({ finish_reason: z.literal("stop"), message: z.object({ content: z.string().min(1) }) }),
        ).min(1),
      })
      .parse(await response.json());
    const content = data.choices[0].message.content.trim();

    // Remove markdown code blocks if present
    const jsonContent = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const selections = z.array(z.object({
      mcc: z.string().regex(/^\d{4}$/), reasoning: z.string().trim().min(1),
    })).max(3).parse(JSON.parse(jsonContent));
    const seen = new Set<string>();
    return selections.map(selection => {
      const reference = mccDatabase.find(code => code.mcc === selection.mcc);
      if (!reference || seen.has(selection.mcc)) throw new Error("Classifier returned an unknown or duplicate MCC code");
      seen.add(selection.mcc);
      return { ...reference, reasoning: selection.reasoning };
    });
  }
}

// Main execution
const businessName = process.argv[2] || "Jalebi Street";

console.log("🚀 SF Business Code Lookup Tool");
console.log("================================\n");

lookupBusinessCodes(businessName).then((result) => {
  if (result.success) {
    console.log("\n✅ Lookup completed successfully!");
    process.exitCode = 0;
  } else {
    console.log("\n❌ Lookup failed!");
    process.exitCode = 1;
  }
}).catch(() => { console.error("Lookup failed during cleanup or execution"); process.exitCode = 1; });
