import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod/v4";
import chalk from "chalk";
import boxen from "boxen";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const browser = await browserbase.launch({
    apiKey: process.env.BROWSERBASE_API_KEY!,
  });
  let stagehand: Stagehand | undefined;
  try {
    stagehand = await Stagehand.create({ browser });
    const page = (await browser.context.pages())[0];

    if (browser.provider === "browserbase" && browser.sessionId) {
    console.log(
      "Session completed. Waiting for 10 seconds to see the logs and recording...",
    );

    // Log your session recording in the terminal so you can see it
    console.log(
      boxen(
        `View this session recording in your browser: \n${chalk.blue(
          `https://browserbase.com/sessions/${browser.sessionId}`,
        )}`,
        {
          title: "Browserbase",
          padding: 1,
          margin: 3,
        },
      ),
    );
    }

  // Navigate to Hacker News
    await page.goto("https://news.ycombinator.com");

  console.log("Pulling news from Hacker News...");

  // Extract the top 3 stories from the Hacker News homepage
    const headlines = (
      await stagehand.extract(
      "Extract the top 3 stories from the Hacker News homepage.",
      z.object({
        stories: z.array(
          z.object({
            title: z.string(),
            url: z.string(),
          }),
        ),
      }),
    )
    ).data;

    console.log(headlines);
  } finally {
    try { await stagehand?.close(); } finally { await browser.close(); }
  }
}

main();
