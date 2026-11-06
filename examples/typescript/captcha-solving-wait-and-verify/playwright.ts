import Browserbase from "@browserbasehq/sdk";
import { chromium, type Browser, type ConsoleMessage } from "playwright-core";
import { config, report } from "./config.js";
import { CaptchaMonitor, waitAndVerify } from "./wait-and-verify.js";

async function main() {
  const c = config();
  const bb = new Browserbase({ apiKey: c.apiKey });
  const session = await bb.sessions.create({
    proxies: c.proxies,
    browserSettings: { solveCaptchas: true, verified: c.verified },
  });
  let browser: Browser | undefined;
  try {
    console.log(`Session: https://www.browserbase.com/sessions/${session.id}`);
    browser = await chromium.connectOverCDP(session.connectUrl);
    const context = browser.contexts()[0];
    const page = context.pages()[0] ?? (await context.newPage());
    const monitor = new CaptchaMonitor();
    const onConsole = (message: ConsoleMessage) => monitor.receive(message.text());
    page.on("console", onConsole);
    try {
      const outcome = await waitAndVerify({
        monitor,
        timeoutMs: c.timeoutMs,
        navigate: (timeout) =>
          page.goto(c.targetUrl, { waitUntil: "domcontentloaded", timeout: timeout + 1000 }),
        isReady: () => page.locator(c.selector).isVisible(),
      });
      report(outcome);
      if (outcome.status !== "ready") return;
      // Continue your workflow here after verifying access.
    } finally {
      page.off("console", onConsole);
    }
  } finally {
    try {
      await browser?.close();
    } finally {
      await bb.sessions.update(session.id, { status: "REQUEST_RELEASE" });
    }
  }
}
main().catch(() => {
  console.error("Run failed; check configuration and the session replay.");
  process.exitCode = 1;
});
