import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import dotenv from "dotenv";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";

dotenv.config();

export async function testConnection(): Promise<void> {
  console.log("🧪 Testing Browserbase connection...");

  if (!process.env.BROWSERBASE_API_KEY) {
    console.error("❌ BROWSERBASE_API_KEY not found in environment variables");
    process.exitCode = 1;
    return;
  }


  let stagehand: Stagehand | null = null;

  try {
    stagehand = await Stagehand.create(
      StagehandCreateOptionsSchema.parse({
        browser: await browserbase.launch({
          apiKey: process.env.BROWSERBASE_API_KEY!,
        }),
      }),
    );

    console.log("✅ Stagehand initialized");

    // Initialize Stagehand session

    console.log("✅ Stagehand session started");

    // Test basic navigation
    await (await stagehand.browser.context.activePage())!.goto(
      "https://airline_portal.com",
    );
    console.log("✅ Successfully navigated to AirlinePortal.com");

    // Test basic extraction
    const title = (
      await stagehand.extract("Get the page title", {
        page: (await stagehand.browser.context.activePage())!,
      })
    ).data;
    console.log(
      "✅ Page title extracted:",
      title.extraction ? JSON.parse(title.extraction as string) : title,
    );

    console.log("🎉 Connection test successful!");
  } catch (error) {
    console.error("❌ Connection test failed:", error);
    process.exitCode = 1;
  } finally {
    if (stagehand) {
      let cleanupError: unknown;
      try {
        await stagehand.close();
      } catch (error) {
        cleanupError = error;
      }
      try {
        await stagehand.browser.close();
      } catch (error) {
        cleanupError ??= error;
      }
      if (cleanupError) {
        process.exitCode = 1;
        console.error("❌ Cleanup failed:", cleanupError);
      } else {
        console.log("✅ Cleanup completed");
      }
    }
  }
}

testConnection();
