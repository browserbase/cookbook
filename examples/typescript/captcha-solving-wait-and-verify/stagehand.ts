import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import { config, report } from "./config.js";
import { CaptchaMonitor, waitAndVerify } from "./wait-and-verify.js";

async function main() {
  const c = config();
  const browser = await browserbase.launch({
    apiKey: c.apiKey,
    proxies: c.proxies,
    browserSettings: { solveCaptchas: true, verified: c.verified },
  });
  let stagehand: Stagehand | undefined;
  try {
    console.log(`Session: https://www.browserbase.com/sessions/${browser.sessionId}`);
    stagehand = await Stagehand.create({ browser });
    const page = await browser.context.newPage();
    const monitor = new CaptchaMonitor();
    // Stagehand v4 exposes the console event's CDP payload, not ConsoleMessage.text().
    const subscription = await page.on("console", (event) => {
      if (event.method !== "Runtime.consoleAPICalled") return;
      const args = event.params?.args;
      if (Array.isArray(args)) {
        for (const arg of args)
          if (arg && typeof arg === "object" && "type" in arg && arg.type === "string")
            monitor.receive(arg.value);
      }
    });
    try {
      const outcome = await waitAndVerify({
        monitor,
        timeoutMs: c.timeoutMs,
        navigate: (timeoutMs) =>
          page.goto(c.targetUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs + 1000 }),
        isReady: () => page.locator(c.selector).isVisible(),
      });
      report(outcome);
      if (outcome.status !== "ready") return;
      // Continue your workflow here after verifying access.
    } finally {
      await subscription.unsubscribe();
    }
  } finally {
    try {
      await stagehand?.close();
    } finally {
      await browser.close();
    }
  }
}
main().catch(() => {
  console.error("Run failed; check configuration and the session replay.");
  process.exitCode = 1;
});
