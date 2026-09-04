import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { resolve } from "node:path";
import { loadConfig } from "../src/config.js";
import {
  makeBrowserbase,
  createContext,
  liveViewUrl,
  releaseSession,
  waitUntilReleased,
} from "../src/bb.js";
import { makeLoginStagehand } from "../src/stagehand-session.js";
import { platformByKey } from "../src/platforms.js";
import { openUrl } from "../src/open-url.js";
import { upsertEnv } from "../src/env-file.js";
import { box } from "../src/logger.js";

/**
 * One-time login for a given platform (default: square). Creates a fresh Browserbase context, opens a
 * live session pre-navigated to that platform's login page, which you log into by hand, then ends the
 * session so your auth is saved into the context. The id is written to the platform's own env var
 * (e.g. SQUARE_CONTEXT_ID / VAGARO_CONTEXT_ID) so sites never collide.
 *
 * Ordering matters: persist:true only flushes cookies/auth into the context when the session ENDS —
 * so we wait for you to finish, then release the session.
 *
 * Usage: `npm run customer-login` (square) or `npm run customer-login:vagaro`.
 */
async function main(): Promise<void> {
  const platform = platformByKey(process.argv[2] || "square");
  loadConfig(); // only needs BROWSERBASE_API_KEY
  const bb = makeBrowserbase();

  console.log(`Creating a fresh Browserbase context for ${platform.label}…`);
  const contextId = await createContext(bb);

  // Create the session via Stagehand so we can drive it to the login page before handing off.
  const sh = await makeLoginStagehand(contextId);
  const sessionId = sh.browser.sessionId!;
  console.log(`Navigating to ${platform.loginUrl}…`);
  await (
    await sh.browser.context.pages()
  )[0].goto(platform.loginUrl, { timeout: 60_000 });

  // Disconnect Stagehand but keep the session alive (keepAlive) for manual login.
  await sh.close().catch(() => {});

  const url = await liveViewUrl(bb, sessionId);
  openUrl(url);

  box([
    `${platform.label} login`,
    "",
    `A browser tab just opened to your live Browserbase session, already on ${platform.label}.`,
    "(If it didn't, open the URL printed below.)",
    "",
    `1. Sign in to ${platform.label} with the test credentials.`,
    "2. Make sure you reach the logged-in dashboard.",
    "3. Come back here and press ENTER to finish.",
    "   Pressing ENTER ends the session so your login is saved.",
  ]);
  console.log(`\nLive view: ${url}\n`);

  const rl = createInterface({ input: stdin, output: stdout });
  await rl.question(
    `Press ENTER once you're logged in and see the ${platform.label} dashboard… `,
  );
  rl.close();

  console.log("Finishing the session so your login is saved to the context…");
  await releaseSession(bb, sessionId);
  await waitUntilReleased(bb, sessionId);

  await upsertEnv(
    resolve(process.cwd(), ".env"),
    platform.contextEnv,
    contextId,
  );
  console.log(`\n✓ Saved ${platform.contextEnv}=${contextId} to .env`);
  console.log("You're ready to run workflows, e.g.:");
  console.log(`  npm run ${platform.key}/customer-list -- --volume 3`);
}

main().catch((err) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
