// Basic CAPTCHA Solving with Browserbase - See README.md for full documentation

import "dotenv/config";
import { browserbase, Stagehand } from "@browserbasehq/stagehand";

async function main() {
  // Initialize Stagehand with Browserbase for cloud-based browser automation.
  // Enable captcha solving in browser settings for automatic CAPTCHA handling.

  const solveCaptchas = true; // Set to false to disable automatic captcha solving (true by default)

  const browser = await browserbase.launch({
    apiKey: process.env.BROWSERBASE_API_KEY!,
    browserSettings: {
      solveCaptchas: solveCaptchas,
    },
  });
  let stagehand: Awaited<ReturnType<typeof Stagehand.create>> | undefined;

  try {
    stagehand = await Stagehand.create({ browser, logging: { level: "info" } });
    // Initialize browser session to start automation.

    console.log("Stagehand initialized successfully!");
    const page = (await browser.context.pages())[0];

    // Subscribe before navigation so an early completion event is not missed.
    if (solveCaptchas) {
      console.log("Waiting for captcha to be solved...");
      let resolveCaptcha!: (solved: boolean) => void;
      const captchaSolved = new Promise<boolean>((resolve) => {
        resolveCaptcha = resolve;
      });
      let subscription: Awaited<ReturnType<typeof page.on>> | undefined;
      const timer = setTimeout(() => resolveCaptcha(false), 60_000);
      try {
        subscription = await page.on("console", (event) => {
          const args = event.params.args;
          if (!Array.isArray(args)) return;
          const message = args
            .map((arg) => {
              if (typeof arg === "object" && arg !== null && !Array.isArray(arg) && "value" in arg) {
                return String(arg.value);
              }
              return "";
            })
            .join(" ");

          if (message === "browserbase-solving-started") {
            console.log("Captcha solving in progress...");
          } else if (message === "browserbase-solving-finished") {
            console.log("Captcha solving completed!");
            resolveCaptcha(true);
          }
        });
        console.log("Navigating to CAPTCHA demo page...");
        await page.goto("https://google.com/recaptcha/api2/demo", { timeout: 60_000 });
        if (!(await captchaSolved)) {
          throw new Error("Captcha solving did not finish within 60 seconds");
        }
      } finally {
        clearTimeout(timer);
        await subscription?.unsubscribe();
      }
    } else {
      console.log("Captcha solving is disabled. Skipping wait...");
      await page.goto("https://google.com/recaptcha/api2/demo", { timeout: 60_000 });
    }

    // Click submit again after captcha is solved to complete the form submission.
    console.log("Clicking submit button after captcha is solved...");
    const submitted = await stagehand.act("Click the Submit button", { page });
    if (submitted?.data?.success !== true) {
      throw new Error("Failed to submit the CAPTCHA form");
    }

    // Extract and display the page content after submission.
    console.log("Extracting page content...");
    const { data: text } = await stagehand.extract("Extract all the text on this page", { page });
    console.log("Page content:");
    console.log(text);
  } catch (error) {
    console.error("Error during CAPTCHA solving:", error);
    throw error;
  } finally {
    // Always close session to release resources and clean up.
    try {
      await stagehand?.close();
    } finally {
      await browser.close();
    }
    console.log("Session closed successfully");
  }
}

main().catch((err) => {
  console.error("Error in CAPTCHA solving example:", err);
  console.error("Common issues:");
  console.error("  - Check .env file has BROWSERBASE_API_KEY");
  console.error("  - Verify solveCaptchas is enabled in browserSettings");
  console.error("  - Ensure the demo page is accessible");
  console.error("Docs: https://docs.stagehand.dev/v4/first-steps/introduction");
  process.exit(1);
});
