import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { browserbase } from "@browserbasehq/stagehand";
import { bb, protectedText, reportError, secureUrl } from "./config.js";

async function main(): Promise<void> {
  const contextId = process.env.BROWSERBASE_CONTEXT_ID?.trim() ||
    (await bb.contexts.create({})).id;
  // Authenticated Fetch: https://docs.browserbase.com/platform/fetch/authenticated-fetch
  const session = await bb.sessions.create({
    api_timeout: 180,
    browserSettings: { context: { id: contextId, persist: true } },
  });

  let browser: Awaited<ReturnType<typeof browserbase.connect>> | undefined;
  try {
    browser = await browserbase.connect({ apiKey: process.env.BROWSERBASE_API_KEY!, sessionId: session.id });
    const page = await browser.context.activePage();
    assert(page, "No active browser page.");
    await page.goto("https://the-internet.herokuapp.com/login");
    // Public demo credentials published on this test site's login page.
    await page.locator("#username").fill("tomsmith");
    await page.locator("#password").fill("SuperSecretPassword!");
    await page.locator('button[type="submit"]').click();
    await page.waitForSelector('a[href="/logout"]');
    assert(await page.url() === secureUrl &&
      (await page.locator("body").innerText()).includes(protectedText),
      "Protected content missing after login.");
    console.log("Protected content verified in the browser.");
  } finally {
    try {
      await bb.sessions.update(session.id, { status: "REQUEST_RELEASE" });
    } finally {
      await browser?.close();
    }
  }

  const deadline = Date.now() + 60_000;
  while ((await bb.sessions.retrieve(session.id)).status !== "COMPLETED") {
    if (Date.now() >= deadline) throw new Error("Session did not complete within 60 seconds.");
    await delay(1000);
  }
  // Context synchronization can take a few seconds after the session ends.
  await delay(5000);
  console.log("Session ended. Set this in your local .env, then run pnpm start:");
  console.log(`BROWSERBASE_CONTEXT_ID=${contextId}`);
}

main().catch(() => reportError(new Error("Login failed. Check configuration and the browser session in the Browserbase dashboard.")));
