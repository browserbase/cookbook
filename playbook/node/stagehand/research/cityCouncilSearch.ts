import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import boxen from "boxen";
import chalk from "chalk";
import { z } from "zod/v4"; // used for extract schema

async function main() {
  const browser = await browserbase.launch({
    apiKey: process.env.BROWSERBASE_API_KEY!,
  });
  const stagehand = await Stagehand.create({ browser });

  // Initialize the stagehand instance

  const page = (await browser.context.pages())[0];

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
  await page.goto("https://phila.legistar.com/");

  await stagehand.act("click calendar from the navigation menu");
  const currentYear = new Date().getFullYear();
  await stagehand.act(`select ${currentYear} from the year dropdown`);

  const results = (
    await stagehand.extract(
      "Extract the table with the name, date and time of the events",
      z.object({
        results: z.array(
          z.object({
            name: z.string(),
            date: z.string(),
            time: z.string(),
          }),
        ),
      }),
    )
  ).data;
  console.log(results);

  // Close the stagehand instance
  await stagehand.close();
  await browser.close();
}

main();
