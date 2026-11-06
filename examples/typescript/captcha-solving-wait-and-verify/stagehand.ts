import "dotenv/config";
import { setTimeout as sleep } from "node:timers/promises";
import { browserbase } from "@browserbasehq/stagehand";

const { BROWSERBASE_API_KEY, TARGET_URL, EXPECTED_SELECTOR } = process.env;
if (!BROWSERBASE_API_KEY || !TARGET_URL || !EXPECTED_SELECTOR) {
  throw new Error("Set BROWSERBASE_API_KEY, TARGET_URL, and EXPECTED_SELECTOR in .env");
}

const browser = await browserbase.launch({
  apiKey: BROWSERBASE_API_KEY,
  proxies: process.env.USE_PROXIES === "true",
  browserSettings: { solveCaptchas: true, verified: process.env.USE_VERIFIED === "true" },
});
let timer: ReturnType<typeof setTimeout> | undefined;
let stopped = false;
try {
  console.log(`Session: https://www.browserbase.com/sessions/${browser.sessionId}`);
  const page = await browser.context.newPage();
  let solving = false;
  let finishedAt = 0;
  let revision = 0;
  let revisited = false;

  const subscription = await page.on("console", (event) => {
    if (event.method !== "Runtime.consoleAPICalled") return;
    const args = event.params?.args;
    if (!Array.isArray(args)) return;
    for (const arg of args) {
      if (!arg || typeof arg !== "object" || !("value" in arg)) continue;
      const message = arg.value;
      if (
        message !== "browserbase-solving-started" &&
        message !== "browserbase-solving-finished" &&
        message !== "browserbase-solving-errored"
      )
        continue;
      console.log(message);
      revision++;
      solving = message === "browserbase-solving-started";
      finishedAt = message === "browserbase-solving-finished" ? performance.now() : 0;
    }
  });

  async function waitForPage() {
    await page.goto(TARGET_URL!, { waitUntil: "domcontentloaded" });
    while (!stopped) {
      if (!solving) {
        const before = revision;
        const ready = await page.locator(EXPECTED_SELECTOR!).isVisible();
        // Ignore a readiness result if a new solver event arrived during the check.
        if (stopped) return;
        if (before === revision && !solving) {
          if (ready) {
            console.log("Page ready");
            return;
          }
          if (finishedAt && !revisited && performance.now() - finishedAt >= 3_000) {
            revisited = true;
            await page.goto(TARGET_URL!, { waitUntil: "domcontentloaded" });
          }
        }
      }
      await sleep(100);
    }
  }

  try {
    await Promise.race([
      waitForPage(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          stopped = true;
          console.error(
            solving ? "Timed out while solving; no human handoff." : "Page still blocked.",
          );
          reject(new Error("CAPTCHA readiness deadline exceeded"));
        }, 90_000);
      }),
    ]);
    // Continue your workflow here, after verifying access.
  } finally {
    stopped = true;
    clearTimeout(timer);
    await subscription.unsubscribe();
  }
} catch {
  console.error("Run failed. Check configuration and the session replay.");
  process.exitCode = 1;
} finally {
  await browser.close();
}
