import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
/**
 * 🤘 Welcome to Stagehand!
 *
 * You probably DON'T NEED TO BE IN THIS FILE
 *
 * You're probably instead looking for the main() function in main.ts
 *
 * This is run when you do npm run start; it just calls main()
 *
 */

import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import StagehandConfig from "./stagehand.config.js";
import chalk from "chalk";
import { main } from "./main.js";
import boxen from "boxen";

async function run() {
  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse(await StagehandConfig()),
  );

  if (stagehand.browser.sessionId) {
    console.log(
      boxen(
        `View this session live in your browser: \n${chalk.blue(
          `https://browserbase.com/sessions/${stagehand.browser.sessionId}`,
        )}`,
        {
          title: "Browserbase",
          padding: 1,
          margin: 3,
        },
      ),
    );
  }

  const page = (await stagehand.browser.context.activePage())!;
  const context = stagehand.browser.context;
  await main({
    page,
    context,
    stagehand,
  });
  await stagehand.close();
  await stagehand.browser.close();
  console.log(
    `\n🤘 Thanks for using Stagehand! Create an issue if you have any feedback: ${chalk.blue(
      "https://github.com/browserbase/stagehand/issues/new",
    )}\n`,
  );
}

run();
