import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
/** Repeat the same agent task and compare timing. The current runner does not implement cache replay or report cache-hit evidence. */

import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import "dotenv/config";
import { runBrowserTask } from "./../browser-task.js";



interface RunResult {
  runNumber: number;
  elapsed: number;
  stepCount: number;
  success: boolean;
  cacheHit: null;
}

async function runAgentTask(runNumber: number): Promise<RunResult> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`AGENT RUN ${runNumber}`);
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
    // Navigate to a simple page
    console.log("\nNavigating to demo page...");
    await page.goto("https://the-internet.herokuapp.com/");
    await page.waitForLoadState("domcontentloaded");

    // Create agent and execute a simple task
    console.log("\nCreating agent...");
    const agent = (task: Parameters<typeof runBrowserTask>[1]) =>
      runBrowserTask(stagehand!, task, {});

    console.log("\nExecuting agent task...");
    console.log(`  Instruction: "Click on the 'Form Authentication' link"`);

    const agentStartTime = Date.now();

    const result = await agent({
      instruction: "Click on the 'Form Authentication' link",
      maxSteps: 5,
    });

    const agentElapsed = Date.now() - agentStartTime;

    const cacheHit = null;
    console.log(`Agent completed in ${agentElapsed}ms`);
    console.log(`Success: ${result.success}`);
    console.log(`Steps: ${result.actions?.length ?? 0}`);
    console.log("Cache: UNVERIFIED (runner provides no cache evidence)");
    const elapsed = Date.now() - startTime;

    await stagehand.close();
    await stagehand.browser.close();

    return {
      runNumber,
      elapsed,
      stepCount: result.actions?.length ?? 0,
      success: result.success,
      cacheHit,
    };
  } catch (error) {
    console.error("Error:", error);
    await stagehand.close();
    await stagehand.browser.close();
    throw error;
  }
}

async function main() {
  console.log(`
${"#".repeat(60)}
#  Stagehand Repeated Agent Task Demo
#
#  Compares repeated task durations; cache replay is not implemented.
${"#".repeat(60)}
`);

  const results: RunResult[] = [];

  // Run 1: First execution - should be cache MISS
  console.log("\n\n>>> PHASE 1: First agent run (measure first execution)");
  results.push(await runAgentTask(1));

  // Wait a moment between runs
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Run 2: Same task again - should be cache HIT
  console.log("\n\n>>> PHASE 2: Second agent run (measure repeated execution)");
  results.push(await runAgentTask(2));

  // Inspect cache contents


  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("RESULTS SUMMARY");
  console.log("=".repeat(60));

  console.log("\n| Run | Time (ms) | Steps | Success | Cache  |");
  console.log("|-----|-----------|-------|---------|--------|");

  for (const r of results) {
    const timeDisplay = r.elapsed.toString().padStart(9);
    const stepsDisplay = r.stepCount.toString().padStart(5);
    const successDisplay = r.success ? "Yes" : "No ";
    const cacheDisplay = "UNVERIFIED";
    console.log(
      `|  ${r.runNumber}  | ${timeDisplay} | ${stepsDisplay} | ${successDisplay}     | ${cacheDisplay}   |`,
    );
  }

  if (results.length >= 2) {
    const speedup = (results[0].elapsed / results[1].elapsed).toFixed(1);
    console.log(`\nObserved first/second duration ratio: ${speedup}x; no cache attribution`);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("KEY FINDINGS");
  console.log("=".repeat(60));

  console.log("This runner executes each task anew. Cache replay is not implemented or measured.");
  console.log("Compare success and elapsed time across runs; speed does not establish caching.");
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
