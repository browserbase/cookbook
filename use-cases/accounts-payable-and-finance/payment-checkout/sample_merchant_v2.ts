import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";

async function main() {
  // Initialize Stagehand (v2 style)
  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await browserbase.launch({
        apiKey: process.env.BROWSERBASE_API_KEY!,
      }),
      model: { modelName: "openai/gpt-4o" },
    }),
  );

  // Initialize Stagehand
  console.log("Initializing Stagehand...");

  console.log("Stagehand initialized successfully.");

  // Get the page instance (v2 style)
  const page = (await stagehand.browser.context.activePage())!;
  if (!page) {
    throw new Error("Failed to get page instance from Stagehand");
  }

  try {
    // Step 1: Navigate to URL
    console.log(
      "Navigating to: https://merchant.example.invalid/store/sample-merchant-san-francisco-974839",
    );
    await page.goto("https://merchant.example.invalid/store/sample-merchant-san-francisco-974839");

    // Wait 60 seconds for manual interaction
    console.log("⏸️  Waiting 60 seconds for manual interaction...");
    console.log(
      "Please complete the checkout steps manually and get to the card payment screen.",
    );
    await new Promise((resolve) => setTimeout(resolve, 60000));
    console.log("▶️  Resuming automation - starting card entry...");

    // Step 18: Card number (v2 API with iframes flag)
    console.log(`Entering card number into iframe field...`);
    await stagehand.act(`type '5556710846285111' into the card number input`, {
      page: page,
    });

    // Step 19: Expiration date (v2 API with iframes flag)
    console.log(`Entering expiration date into iframe field...`);
    await stagehand.act(`type '1028' into the expiration input`, {
      page: page,
    });

    // Step 20: CVC (v2 API with iframes flag)
    console.log(`Entering CVC into iframe field...`);
    await stagehand.act(`type '123' into the CVC input`, { page: page });

    // Step 21: Zip code (v2 API with iframes flag)
    console.log(`Entering zip code into iframe field...`);
    await stagehand.act(`type '94107' into the zip code input`, { page: page });

    // Submit card
    console.log(`Submitting card information...`);
    await stagehand.act(`click the Add your card button`, { page: page });

    console.log("Order flow completed! Waiting 30 seconds for review...");
    await page.waitForTimeout(30000);
  } catch (error) {
    console.error("Error during order flow:", error);
    throw error;
  } finally {
    console.log("Closing Stagehand...");
    await stagehand.close();
    await stagehand.browser.close();
  }
}

main().catch(console.error);
