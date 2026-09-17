import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import boxen from "boxen";
import { z } from "zod/v4";

async function main() {
  const browser = await browserbase.launch({
    apiKey: process.env.BROWSERBASE_API_KEY!,
  });
  const stagehand = await Stagehand.create({
    browser,
    model: {
      modelName: "google/gemini-2.0-flash",
      ...{
        apiKey: process.env.GOOGLE_API_KEY,
      },
    },
  });

  // Initialize the stagehand instance

  const page = (await browser.context.pages())[0];

  // If running in Browserbase, print a link to the session
  if (browser.provider === "browserbase" && browser.sessionId) {
    console.log(
      boxen(
        `View this session live in your browser: \n${`https://browserbase.com/sessions/${browser.sessionId}`}`,
        {
          title: "Browserbase",
          padding: 1,
          margin: 3,
        },
      ),
    );
  }

  // Define the inputs for the form
  const inputs = {
    superpower: "Invisibility",
    features_used: ["Verified", "Proxies", "Session Replay"],
    coolest_build:
      "A bot that automates form submissions across multiple sites.",
  };
  // Navigate to page
  await page.goto("https://forms.gle/f4yNQqZKBFCbCr6j7");

  // You can use the observe method to find the selector with an act command to fill it in
  const superpowerSelector = (
    await stagehand.observe(
      `Find the selector for the superpower field: ${inputs.superpower}`,
    )
  ).data;
  await stagehand.act(superpowerSelector[0]);

  // You can also explicitly specify the action to take
  for (const feature of inputs.features_used) {
    await stagehand.act("Select the features used: " + feature);
  }

  // Fill in the text field with the coolest project you have built
  await stagehand.act(
    "Fill in the Coolest Project you have built field with the following value: " +
      inputs.coolest_build,
  );

  // Click the submit button
  await stagehand.act("Click the submit button");

  // Wait for 5 seconds
  await page.waitForTimeout(5000);

  // Extract to log the status of the form
  const status = (
    await stagehand.extract(
      "Extract the status of the form",
      z.object({ status: z.string() }),
    )
  ).data;
  console.log(status);

  // Close the stagehand instance
  await stagehand.close();
  await browser.close();
}

main();
