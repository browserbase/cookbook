import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  // payment page URL
  const link = process.env.PAYMENT_URL;
  if (!link) throw new Error("Set PAYMENT_URL to an authorized payment page.");

  // Initialize Stagehand
  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await browserbase.launch({
        apiKey: process.env.BROWSERBASE_API_KEY!,
        projectId: process.env.BROWSERBASE_PROJECT_ID,
      }),
      model: { modelName: "openai/gpt-4o" },
    }),
  );

  const page = (await stagehand.browser.context.activePage())!;

  console.log(
    `https://www.browserbase.com/sessions/${stagehand.browser.sessionId}`,
  );

  // Navigate to the payment page
  await page.goto(link, { waitUntil: "load" });
  await page.waitForTimeout(3000);

  // Use Stagehand to find and click the Card accordion across iframes
  console.log("Using Stagehand to find Card accordion...");

  const cardAccordion = (
    await stagehand.observe("Find the Card payment option accordion button", {
      page: page,
    })
  ).data;

  console.log("Found card accordion:", cardAccordion);

  if (cardAccordion && cardAccordion.length > 0) {
    console.log("Clicking card accordion...");
    const result = await stagehand.act(cardAccordion[0], { page: page });
    console.log("Act result:", result);
  } else {
    console.error("Card accordion not found");
  }

  await stagehand.close();
  await stagehand.browser.close();
}

main().catch(console.error);
