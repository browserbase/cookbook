import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
/**
 * Demo 1: Stagehand Act Caching with Variables
 *
 * This demo demonstrates how Stagehand's caching works with variables,
 * specifically showing that:
 *
 * 1. Variable VALUES are NOT stored in the cache (privacy preservation)
 * 2. Only variable KEYS are stored in the cache
 * 3. Cache still works effectively with different variable values
 * 4. Significant performance improvement on subsequent runs
 *
 * How the cache key works:
 * - Cache key = hash(instruction + URL + variableKeys)
 * - Variable values are NOT part of the cache key
 * - At replay time, current variable values are substituted
 *
 * Run this demo multiple times with different usernames to see:
 * - First run: LLM inference (slow, ~2-3s per action)
 * - Subsequent runs: Cache hit (fast, <100ms per action)
 * - Cache file does NOT contain the actual username
 */

import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

const CACHE_DIR = path.join(process.cwd(), ".cache", "act-cache");

// Different usernames to test with - demonstrates cache works with different values
const TEST_USERNAMES = [
  "john.doe@example.com",
  "jane.smith@example.com",
  "secret.user@company.com",
];

interface RunResult {
  username: string;
  elapsed: number;
  belowThreshold: boolean;
}

async function runWithVariables(
  username: string,
  runNumber: number,
): Promise<RunResult> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`RUN ${runNumber}: Testing with username: ${username}`);
  console.log("=".repeat(60));

  const startTime = Date.now();

  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await localBrowser.launch({ headless: false }),
      model: "gpt-4o-mini",
    }),
  );

  const page = (await stagehand.browser.context.pages())[0];

  try {
    // Using a simple form page for demonstration
    console.log("\nNavigating to demo form...");
    await page.goto("https://the-internet.herokuapp.com/login");
    await page.waitForLoadState("domcontentloaded");

    // Check if cache exists before this run
    const cacheExistedBefore =
      fs.existsSync(CACHE_DIR) && fs.readdirSync(CACHE_DIR).length > 0;

    console.log(
      `\nCache before run: ${cacheExistedBefore ? "EXISTS" : "EMPTY"}`,
    );

    // Use act() with variables - the %username% placeholder will be replaced
    // with the actual value at runtime, but NOT stored in the cache
    console.log("\nExecuting act() with variable...");
    console.log(`  Instruction: Type %username% into the username field`);
    console.log(`  Variable: username = "${username}"`);

    const actStartTime = Date.now();

    await stagehand.act("Type %username% into the username field", {
      variables: { username },
    });

    const actElapsed = Date.now() - actStartTime;

    // Report the measured duration without attributing it to caching.
    const belowThreshold = actElapsed < 500;

    console.log(`\nAction completed in ${actElapsed}ms`);
    console.log(
      `Timing: ${belowThreshold ? "below" : "at or above"} 500ms; cache status unverified`,
    );

    const elapsed = Date.now() - startTime;

    await stagehand.close();
    await stagehand.browser.close();

    return {
      username,
      elapsed,
      belowThreshold,
    };
  } catch (error) {
    console.error("Error:", error);
    await stagehand.close();
    await stagehand.browser.close();
    throw error;
  }
}

async function inspectCacheContents() {
  console.log(`\n${"=".repeat(60)}`);
  console.log("CACHE INSPECTION");
  console.log("=".repeat(60));

  if (!fs.existsSync(CACHE_DIR)) {
    console.log("\nNo cache directory found.");
    return { inspected: 0, exposed: 0, placeholders: 0 };
  }

  const cacheFiles = fs
    .readdirSync(CACHE_DIR)
    .filter((f) => f.endsWith(".json"));
  console.log(`\nFound ${cacheFiles.length} cache file(s):`);

  let exposed = 0;
  let placeholders = 0;
  for (const file of cacheFiles) {
    const filePath = path.join(CACHE_DIR, file);
    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    console.log(`\n--- ${file} ---`);
    console.log(`  Version: ${content.version}`);
    console.log(`  Instruction: "${content.instruction}"`);
    console.log(`  URL: ${content.url}`);
    console.log(`  Variable Keys: ${JSON.stringify(content.variableKeys)}`);
    console.log(`  Actions: ${content.actions?.length ?? 0} action(s)`);

    // Show action details
    if (content.actions && content.actions.length > 0) {
      for (const action of content.actions) {
        console.log(`    - Method: ${action.method}`);
        console.log(`      Arguments: ${JSON.stringify(action.arguments)}`);
        console.log(`      Selector: ${action.selector?.substring(0, 50)}...`);
      }
    }

    // IMPORTANT: Check if username value is in the cache
    const cacheString = JSON.stringify(content);
    const containsSecretUser = TEST_USERNAMES.some((u) =>
      cacheString.includes(u),
    );

    if (containsSecretUser) exposed++;
    if (cacheString.includes("%username%")) placeholders++;
    console.log(`\n  PRIVACY CHECK:`);
    console.log(
      `    Contains any test username value? ${containsSecretUser ? "YES (BAD!)" : "NO (GOOD!)"}`,
    );
    console.log(
      `    Variable placeholder preserved? ${cacheString.includes("%username%") ? "YES" : "NO"}`,
    );
  }
  return { inspected: cacheFiles.length, exposed, placeholders };
}

async function main() {
  console.log(`
${"#".repeat(60)}
#  Stagehand Act Caching with Variables Demo
#
#  Demonstrates privacy-preserving cache mechanism:
#  - Variable VALUES are NOT stored in cache
#  - Only variable KEYS are stored
#  - Cache works with different values
${"#".repeat(60)}
`);

  // Clear cache for fresh demo
  const args = process.argv.slice(2);
  if (args.includes("--fresh")) {
    console.log("Clearing cache for fresh run...");
    if (fs.existsSync(CACHE_DIR)) {
      fs.rmSync(CACHE_DIR, { recursive: true });
    }
  }

  const results: RunResult[] = [];

  // Run 1: First username - should be cache MISS (LLM inference)
  console.log(
    "\n\n>>> PHASE 1: First run with first username (expect cache MISS)",
  );
  results.push(await runWithVariables(TEST_USERNAMES[0], 1));

  // Run 2: Same username again - should be cache HIT
  console.log(
    "\n\n>>> PHASE 2: Second run with same username (expect cache HIT)",
  );
  results.push(await runWithVariables(TEST_USERNAMES[0], 2));

  // Run 3: DIFFERENT username - should STILL be cache HIT!
  // This proves that the cache key is based on variable KEYS, not VALUES
  console.log(
    "\n\n>>> PHASE 3: Run with DIFFERENT username (should STILL be cache HIT!)",
  );
  console.log(">>> Compare this run with the previous values; reuse is not assumed");
  results.push(await runWithVariables(TEST_USERNAMES[1], 3));

  // Run 4: Another different username
  console.log(
    "\n\n>>> PHASE 4: Run with yet another username (should be cache HIT)",
  );
  results.push(await runWithVariables(TEST_USERNAMES[2], 4));

  // Inspect cache contents
  const inspection = await inspectCacheContents();

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("RESULTS SUMMARY");
  console.log("=".repeat(60));

  console.log("\n| Run | Username                    | Time (ms) | Timing  |");
  console.log("|-----|-----------------------------|-----------| -------|");

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const usernameDisplay = r.username.substring(0, 25).padEnd(27);
    const timeDisplay = r.elapsed.toString().padStart(9);
    const cacheDisplay = r.belowThreshold ? "<500ms" : ">=500ms";
    console.log(
      `|  ${i + 1}  | ${usernameDisplay} | ${timeDisplay} | ${cacheDisplay}   |`,
    );
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("KEY FINDINGS");
  console.log("=".repeat(60));

  if (inspection.inspected === 0) {
    console.log("PRIVACY UNVERIFIED: no cache files inspected.");
  } else if (inspection.exposed > 0) {
    console.error(`PRIVACY CHECK FAILED: test values found in ${inspection.exposed} of ${inspection.inspected} files.`);
    process.exitCode = 1;
  } else {
    console.log(`Test values absent from ${inspection.inspected} inspected files. This check does not prove general privacy.`);
  }
  console.log(`Variable placeholders found in ${inspection.placeholders} of ${inspection.inspected} files.`);
  const fastRuns = results.filter(result => result.belowThreshold).length;
  console.log(`Timing heuristic: ${fastRuns} of ${results.length} runs below the configured threshold. Timing alone does not verify a cache hit.`);

  console.log(`\n${"=".repeat(60)}`);
  console.log("TRY IT YOURSELF");
  console.log("=".repeat(60));

  console.log(`
1. Run again and compare observed timings:
   npm run demo:act-cache

2. Run with fresh cache:
   npm run demo:act-cache -- --fresh

3. Clear cache manually:
   npm run clear-cache

4. Inspect cache contents:
   cat .cache/act-cache/*.json | jq .
`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
