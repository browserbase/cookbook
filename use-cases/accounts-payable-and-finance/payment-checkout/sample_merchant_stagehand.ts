import Browserbase from "@browserbasehq/sdk";
import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";

async function main() {
  // Initialize Stagehand with Browserbase (v4 API)
  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await browserbase.launch({
        apiKey: process.env.BROWSERBASE_API_KEY!,
        ...{
          browserSettings: {
            verified: true,
            blockAds: true,
            viewport: {
              width: 1024,
              height: 768,
            },
          },
        },
      }),
      model: "anthropic/claude-3-7-sonnet-latest",
    }),
  );

  console.log("Initializing Stagehand...");

  console.log("Stagehand initialized successfully.");

  // v3: Access page via context
  const page = await stagehand.browser.context.activePage();
  if (!page) {
    throw new Error("Failed to get page instance from Stagehand");
  }

  // Get the live view URL
  const debugUrl = (
    await new Browserbase({
      apiKey: process.env.BROWSERBASE_API_KEY,
    }).sessions.debug(stagehand.browser.sessionId!)
  ).debuggerFullscreenUrl;
  console.log(`🔍 Live View Link: ${debugUrl}`);

  try {
    // Step 1: Navigate to Sample Merchant
    console.log("Navigating to Sample Merchant...");
    await page.goto("https://merchant.example.invalid/store/sample-merchant-san-francisco-974839", {
      waitUntil: "load",
    });

    // Wait 60 seconds for manual interaction
    console.log("⏸️  Waiting 50 seconds for manual interaction...");
    console.log(
      "Please complete the checkout steps manually and get to the card payment screen.",
    );
    await new Promise((resolve) => setTimeout(resolve, 60000));

    // console.log("▶️  Resuming automation - starting card entry...");

    // // Step 2: Click Pickup button (v4 API)
    // console.log("Clicking Pickup button...");
    // await stagehand.act("click the Pickup button");

    // // Step 3: Add Greek Fries to cart (v4 API)
    // console.log("Adding Greek Fries to cart...");
    // await stagehand.act("click the plus button next to Greek Fries");

    // console.log("Clicking Add to cart button...");
    // await stagehand.act("click the Add to cart button in the popup");

    // // Step 4: Proceed to checkout (v4 API)
    // console.log("Proceeding to checkout...");
    // await stagehand.act("click the Checkout button");

    // // Step 4: Proceed to checkout (v4 API)
    // await stagehand.act("click on tmr 9 button for the pickup date");

    // await stagehand.act("click on 11:20 AM - 11:30 AM time slot for the pickup time");

    // Step 5: Select Credit/Debit Card payment method (v4 API)
    // console.log("Selecting Credit/Debit Card payment method...");
    // await stagehand.act("click the Credit/Debit Card payment method");

    // Step 6: Fill card details - handle iframe fields carefully
    console.log("Filling card details (handling iframe fields)...");

    try {
      // Card number field
      console.log("Entering card number...");
      await stagehand.act("type '1111111111111111' into the card number field");

      // Expiration date - use observe first to check if field is visible
      console.log("Looking for expiration field...");

      await stagehand.act("type '1028' into the expiration date field", {
        timeout: 15000,
      });

      // CVC field
      console.log("Entering CVC...");
      await stagehand.act("type '123' into the CVC or security code field", {
        timeout: 15000,
      });

      // Zip code field
      console.log("Entering zip code...");
      await stagehand.act("type '94114' into the zip code field", {
        timeout: 15000,
      });

      // Step 7: Submit card information (v4 API)
      console.log("Submitting card information...");
      await stagehand.act("click the Add your card button", {
        timeout: 15000,
      });
    } catch (error) {
      console.error("Error filling card details:", error);
      console.log("Taking screenshot for debugging...");
      await page.screenshot({
        path: "./downloads/error-screenshot.png",
        fullPage: true,
      });
      throw error;
    }

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
