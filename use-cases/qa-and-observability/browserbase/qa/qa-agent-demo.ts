import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import "dotenv/config";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";
import { runBrowserTask } from "./browser-task.js";

/**
 * a synthetic application - Stagehand Agent QA Demo
 *
 * This demo shows how a Stagehand Agent can autonomously QA-test a web app
 * the way a real user would — navigating, clicking, filling forms, and
 * validating results — all described in plain English.
 *
 * Compare this to a traditional Playwright test where every selector is
 * hardcoded and breaks the moment a class name or DOM structure changes.
 */

// ── Test result schema ──────────────────────────────────────────────
const TestResultSchema = z.object({
  testName: z.string().describe("Name of the test case"),
  passed: z.boolean().describe("Whether the test passed"),
  details: z.string().describe("What happened during the test"),
});

const TestSuiteResultSchema = z.object({
  results: z.array(TestResultSchema).describe("All test results"),
  summary: z.string().describe("Overall test suite summary"),
});

// ── Helper: print test results ──────────────────────────────────────
function printResults(results: z.infer<typeof TestSuiteResultSchema>) {
  console.log("\n" + "=".repeat(60));
  console.log("  QA TEST RESULTS");
  console.log("=".repeat(60));

  for (const test of results.results) {
    const icon = test.passed ? "✅" : "❌";
    console.log(`\n${icon}  ${test.testName}`);
    console.log(`   ${test.details}`);
  }

  const passed = results.results.filter((r) => r.passed).length;
  const total = results.results.length;
  console.log("\n" + "-".repeat(60));
  console.log(`  ${passed}/${total} tests passed`);
  console.log(`  ${results.summary}`);
  console.log("=".repeat(60) + "\n");
}

// ── Main demo ───────────────────────────────────────────────────────
async function main() {
  const stagehand = await Stagehand.create(StagehandCreateOptionsSchema.parse({
  browser: await browserbase.launch({ apiKey: process.env.BROWSERBASE_API_KEY! })
  }));



  console.log("\n🚀 Stagehand Agent QA Demo for a synthetic application");
  console.log(`🔗 Watch live: https://browserbase.com/sessions/${stagehand.browser.sessionId}\n`);

  const page = (await stagehand.browser.context.pages())[0];

  // ── Demo 1: Navigation & Content Validation ───────────────────
  // Instead of hardcoding selectors, the agent navigates like a user
  // and validates what it sees.

  console.log("📋 Test Suite 1: Navigation & Content Validation");
  console.log("   Target: https://news.ycombinator.com (public site for demo)\n");

  await page.goto("https://news.ycombinator.com");

  // Use the Agent to run a multi-step QA flow autonomously
  const agent = (task: Parameters<typeof runBrowserTask>[1]) => runBrowserTask(stagehand!, task, {systemPrompt: `You are a QA testing agent. Your job is to thoroughly test
web applications by navigating them like a real user would. For each test:
1. Perform the action described
2. Verify the expected outcome
3. Note any unexpected behavior

Be methodical and report clearly what you observe.`});

  const navResult = await agent({
    instruction: `Run these QA tests on Hacker News:

1. NAVIGATION TEST: Click on the "new" link in the top navigation bar.
   Verify that the page changes and shows newest stories.

2. LINK TEST: Click on the "past" link in the top navigation.
   Verify the page shows past stories.

3. BACK NAVIGATION: Use the browser back button to return.
   Verify you're back on the previous page.

After completing all tests, report your findings.`,
    maxSteps: 15,
  });

  console.log("Agent completed navigation tests:");
  console.log(`  Success: ${navResult.success}`);
  console.log(`  Steps taken: ${navResult.actions?.length ?? 0}`);
  console.log(`  Summary: ${navResult.message}\n`);

  // ── Demo 2: Content Extraction & Validation ───────────────────
  // Traditional tests use fragile selectors to check content.
  // Stagehand extracts structured data and you assert on the shape.

  console.log("📋 Test Suite 2: Content Extraction & Validation\n");

  await page.goto("https://news.ycombinator.com");

  // Extract structured data — no selectors needed
  const stories = (await stagehand.extract("Extract the first 5 story titles and their point counts from the front page", z.array(
        z.object({
          title: z.string().describe("The story headline"),
          points: z.number().nullable().describe("Number of points, or null if not shown"),
          rank: z.number().describe("Position on the page (1-5)"),
        })
      ))).data;

  console.log("  Extracted stories:");
  for (const story of stories) {
    const pts = story.points !== null ? `${story.points} pts` : "no points";
    console.log(`    #${story.rank}: "${story.title}" (${pts})`);
  }

  // Validate the extraction — these are semantic assertions
  const contentTests: z.infer<typeof TestSuiteResultSchema> = {
    results: [
      {
        testName: "Stories are extracted",
        passed: stories.length === 5,
        details: `Expected 5 stories, got ${stories.length}`,
      },
      {
        testName: "Stories have titles",
        passed: stories.every((s) => s.title.length > 0),
        details: "All extracted stories have non-empty titles",
      },
      {
        testName: "Stories are ranked sequentially",
        passed: stories.every((s, i) => s.rank === i + 1),
        details: "Stories are numbered 1 through 5 in order",
      },
      {
        testName: "Points are numeric or null",
        passed: stories.every(
          (s) => s.points === null || (typeof s.points === "number" && s.points >= 0)
        ),
        details: "All point values are valid numbers or null",
      },
    ],
    summary:
      stories.length === 5
        ? "Content extraction and validation passed — structured data matches expectations."
        : "Some content validations failed — see details above.",
  };

  printResults(contentTests);

  // ── Demo 3: Form Interaction Testing ──────────────────────────
  // The agent tests form behavior like a real user — no selectors needed.

  console.log("📋 Test Suite 3: Search / Form Interaction\n");

  await page.goto("https://hn.algolia.com/");

  const searchAgent = (task: Parameters<typeof runBrowserTask>[1]) => runBrowserTask(stagehand, task, {systemPrompt: `You are a QA testing agent focused on testing search functionality.
Test the search feature thoroughly and report what you find.`});

  const searchResult = await searchAgent({
    instruction: `Test the search functionality:

1. Type "artificial intelligence" into the search box.
2. Wait for results to load.
3. Verify that search results appear and are relevant to the query.
4. Clear the search and type "machine learning" instead.
5. Verify that results update to match the new query.

Report what you observe at each step.`,
    maxSteps: 15,
  });

  console.log("Agent completed search tests:");
  console.log(`  Success: ${searchResult.success}`);
  console.log(`  Summary: ${searchResult.message}\n`);

  // Extract final search results to validate
  const searchData = (await stagehand.extract("Extract the titles of the first 3 search results currently displayed", z.array(z.string().describe("Search result title")))).data;

  console.log("  Current search results:");
  searchData.forEach((title, i) => console.log(`    ${i + 1}. ${title}`));

  // ── Summary ───────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("  DEMO COMPLETE");
  console.log("=".repeat(60));
  console.log(`
Key takeaways for Synthetic App:

1. ZERO SELECTORS — Every test used natural language, not CSS/XPath.
   When Synthetic App's UI changes, these tests keep working.

2. AGENT AUTONOMY — The agent navigated multi-step flows on its own,
   adapting to what it found on each page.

3. STRUCTURED VALIDATION — extract() returns typed data you can
   assert against, replacing fragile DOM queries.

4. REAL USER BEHAVIOR — The agent clicks, types, scrolls, and waits
   just like a human user would.

5. SELF-HEALING — If a button changes from "Search" to "Find", if a
   form field moves position, if a nav link gets a new class name —
   Stagehand adapts. Your tests don't break.

Session replay: https://browserbase.com/sessions/${stagehand.browser.sessionId}
`);

  await stagehand.close();
await stagehand.browser.close();
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
