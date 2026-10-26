import { setTimeout as delay } from "node:timers/promises";
import { chromium, type Browser } from "playwright-core";
import { client, protectedText, reportError, secureUrl } from "./config.js";

async function main(): Promise<void> {
  const bb = client();
  const contextId = process.env.BROWSERBASE_CONTEXT_ID?.trim() ||
    (await bb.contexts.create({})).id;
  const session = await bb.sessions.create({
    api_timeout: 180,
    browserSettings: { context: { id: contextId, persist: true } },
  });

  let browser: Browser | undefined;
  try {
    browser = await chromium.connectOverCDP(session.connectUrl);
    const page = browser.contexts()[0].pages()[0];
    await page.goto("https://the-internet.herokuapp.com/login");
    // Public demo credentials published on this test site's login page.
    await page.locator("#username").fill("tomsmith");
    await page.locator("#password").fill("SuperSecretPassword!");
    await page.getByRole("button", { name: "Login" }).click();
    await page.waitForURL(secureUrl);
    await page.getByText(protectedText, { exact: false }).waitFor();
    await page.getByRole("link", { name: "Logout" }).waitFor();
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

main().catch(reportError);
