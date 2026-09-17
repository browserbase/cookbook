import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import "dotenv/config";

export async function createStagehand() {
  const browser = await browserbase.launch({ apiKey: process.env.BROWSERBASE_API_KEY! });
  let stagehand: Stagehand | undefined;
  try {
    stagehand = await Stagehand.create(StagehandCreateOptionsSchema.parse({
      browser,
      model: { modelName: "openai/gpt-4o", apiKey: process.env.OPENAI_API_KEY! },
    }));

  console.log("🌐 Stagehand initialized with Browserbase");
  console.log(
    `📺 Watch the session at: https://www.browserbase.com/sessions`
  );

  // Set extra headers to bypass ngrok interstitial warning page
  await (await stagehand.browser.context.activePage())!.setExtraHTTPHeaders({
    "ngrok-skip-browser-warning": "true",
  });

  return stagehand;
  } catch (error) {
    const cleanup = await Promise.allSettled([
      Promise.resolve().then(() => stagehand?.close()),
      Promise.resolve().then(() => browser.close()),
    ]);
    const failures = cleanup.filter(result => result.status === "rejected").map(result => result.reason);
    if (failures.length) throw new AggregateError([error, ...failures], "QA initialization and cleanup failed");
    throw error;
  }
}
