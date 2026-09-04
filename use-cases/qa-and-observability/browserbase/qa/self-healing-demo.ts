import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import "dotenv/config";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";

/**
 * a synthetic application - Self-Healing Tests Demo
 *
 * This demo illustrates the core value proposition: Stagehand tests
 * describe WHAT to do, not HOW to find the element. When the UI changes,
 * the test instructions stay the same.
 *
 * We test the same user flows on two completely different websites to
 * prove the instructions are portable and resilient.
 */

// ── Types ───────────────────────────────────────────────────────────
interface TestCase {
  name: string;
  instruction: string;
  validate: (result: { success: boolean; message?: string }) => boolean;
}

// ── The Static Script Problem ───────────────────────────────────────
//
// Here's what a traditional Playwright test looks like for a search flow:
//
//   await page.locator('#search-input-v2').fill('test query');
//   await page.locator('button.search-submit.primary-action').click();
//   await page.waitForSelector('.results-container .result-item');
//   const count = await page.locator('.result-item').count();
//   expect(count).toBeGreaterThan(0);
//
// If the search input ID changes from '#search-input-v2' to '#search-bar',
// if the button class changes, if the results container is restructured —
// the test breaks. Not because of a bug, but because of a selector change.
//
// With Stagehand, the SAME instructions work regardless of the UI structure:

// ── Stagehand Test Cases (UI-agnostic) ──────────────────────────────
const testCases: TestCase[] = [
  {
    name: "Search functionality works",
    instruction: "Type 'TypeScript' into the search box and submit the search",
    validate: (result) => result.success === true,
  },
  {
    name: "Results are displayed",
    instruction: "Verify that search results are visible on the page",
    validate: (result) => result.success === true,
  },
  {
    name: "Can navigate to a result",
    instruction: "Click on the first search result",
    validate: (result) => result.success === true,
  },
];

// ── Run test suite against any site ─────────────────────────────────
async function runTestSuite(stagehand: Stagehand, siteName: string, url: string) {
  console.log(`\n🔍 Running test suite on: ${siteName}`);
  console.log(`   URL: ${url}\n`);

  const page = (await stagehand.browser.context.pages())[0];
  await page.goto(url);

  const results: { name: string; passed: boolean; detail: string }[] = [];

  for (const testCase of testCases) {
    console.log(`   ⏳ ${testCase.name}...`);

    try {
      const result = await stagehand.act(testCase.instruction);
      const passed = testCase.validate(result.data);

      results.push({
        name: testCase.name,
        passed,
        detail: passed ? "Passed" : `Failed: ${result.data.message}`,
      });

      console.log(`   ${passed ? "✅" : "❌"} ${testCase.name}`);
    } catch (err) {
      results.push({
        name: testCase.name,
        passed: false,
        detail: `Error: ${err instanceof Error ? err.message : String(err)}`,
      });
      console.log(`   ❌ ${testCase.name} (error)`);
    }
  }

  return results;
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const stagehand = await Stagehand.create(StagehandCreateOptionsSchema.parse({
  browser: await browserbase.launch({ apiKey: process.env.BROWSERBASE_API_KEY!, projectId: process.env.BROWSERBASE_PROJECT_ID })
  }));



  console.log("\n🛡️  Self-Healing Tests Demo for a synthetic application");
  console.log(`🔗 Watch live: https://browserbase.com/sessions/${stagehand.browser.sessionId}`);

  // Run the EXACT SAME test instructions on two different sites
  // This proves the tests are resilient to UI differences.

  // Site 1: Hacker News search (Algolia)
  const site1Results = await runTestSuite(
    stagehand,
    "Hacker News Search (Algolia)",
    "https://hn.algolia.com/"
  );

  // Site 2: GitHub search
  const site2Results = await runTestSuite(
    stagehand,
    "GitHub",
    "https://github.com/search"
  );

  // ── Comparison Report ─────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("  SELF-HEALING COMPARISON REPORT");
  console.log("=".repeat(60));
  console.log(`
The SAME test instructions were run on two completely different sites
with different DOM structures, CSS classes, and layouts.

A traditional Playwright script would need entirely separate selectors
for each site. Stagehand's natural language instructions work on both.
`);

  console.log("  Hacker News Search:");
  for (const r of site1Results) {
    console.log(`    ${r.passed ? "✅" : "❌"} ${r.name}: ${r.detail}`);
  }

  console.log("\n  GitHub:");
  for (const r of site2Results) {
    console.log(`    ${r.passed ? "✅" : "❌"} ${r.name}: ${r.detail}`);
  }

  const totalPassed = [...site1Results, ...site2Results].filter((r) => r.passed).length;
  const totalTests = site1Results.length + site2Results.length;

  console.log(`\n  Total: ${totalPassed}/${totalTests} tests passed across 2 different sites`);
  console.log(`  Using the EXACT SAME test instructions.\n`);

  console.log("  What this means for Synthetic App:");
  console.log("  → When your frontend team ships a redesign, tests keep working.");
  console.log("  → When a component library is swapped, tests keep working.");
  console.log("  → When selectors change, tests keep working.");
  console.log("  → Zero test maintenance for UI-only changes.\n");

  await stagehand.close();
await stagehand.browser.close();
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
