import { setTimeout as sleep } from "node:timers/promises";
import { browserbase } from "@browserbasehq/stagehand";

const target = process.env.TARGET_URL!;
const selector = process.env.EXPECTED_SELECTOR!;
const browser = await browserbase.launch({
  apiKey: process.env.BROWSERBASE_API_KEY!,
  browserSettings: { solveCaptchas: true },
});

try {
  const page = await browser.context.newPage();
  let solving = false,
    finished = false,
    revisited = false,
    ready = false,
    revision = 0;
  await page.on("console", ({ params }) => {
    if (!Array.isArray(params?.args)) return;
    for (const arg of params.args) {
      if (!arg || typeof arg !== "object" || !("value" in arg)) continue;
      const message = arg.value;
      if (message === "browserbase-solving-started") solving = true;
      else if (message === "browserbase-solving-finished") solving = false;
      else if (message === "browserbase-solving-errored") solving = false;
      else continue;
      finished = message === "browserbase-solving-finished";
      revision++;
    }
  });

  const deadline = performance.now() + 90_000;
  const remaining = () => Math.max(1, deadline - performance.now());
  await page.goto(target, { waitUntil: "domcontentloaded", timeout: remaining() });
  while (performance.now() < deadline) {
    if (!solving) {
      const before = revision;
      const visible = await page.locator(selector).isVisible({ timeout: remaining() });
      if (performance.now() >= deadline) break;
      if (before === revision) {
        if (visible) {
          ready = true;
          break;
        }
        if (finished && !revisited) {
          revisited = true;
          await page.goto(target, { waitUntil: "domcontentloaded", timeout: remaining() });
        }
      }
    }
    await sleep(100);
  }
  if (!ready)
    throw new Error(solving ? "Timed out while solving; no human handoff." : "Page still blocked.");
  console.log("Page ready");
} finally {
  await browser.close();
}
