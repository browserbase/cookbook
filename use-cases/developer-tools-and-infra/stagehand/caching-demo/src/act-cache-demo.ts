import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
/**
 * Stagehand Act Caching with Variables
 *
 * Demonstrates privacy-preserving caching:
 * - Variable VALUES are NOT stored in cache (only keys)
 * - Different values still hit the same cache entry
 * - ~100x speedup on cache hits
 */

import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import "dotenv/config";

const CACHE_DIR = ".cache/act-cache";

async function demo() {
  const usernames = [
    "john.doe@example.com",
    "jane.smith@example.com",
    "synthetic.user@example.invalid",
  ];

  for (let i = 0; i < usernames.length; i++) {
    const username = usernames[i];
    console.log(`\nRun ${i + 1}: ${username}`);

    const stagehand = await Stagehand.create(
      StagehandCreateOptionsSchema.parse({
        browser: await localBrowser.launch({ headless: false }),
      }),
    );

    const page = (await stagehand.browser.context.pages())[0];

    await page.goto("https://the-internet.herokuapp.com/login");
    await page.waitForLoadState("domcontentloaded");

    const start = Date.now();

    // The %username% placeholder is replaced at runtime
    // but NOT stored in cache - only the key "username" is cached
    await stagehand.act("Type %username% into the username field", {
      variables: { username },
    });

    const elapsed = Date.now() - start;
    const cacheHit = elapsed < 500;

    console.log(`  → ${elapsed}ms (${cacheHit ? "CACHE HIT" : "CACHE MISS"})`);

    await stagehand.close();
    await stagehand.browser.close();
  }
}

demo().catch(console.error);
