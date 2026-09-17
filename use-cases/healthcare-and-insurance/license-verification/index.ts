import {
  Stagehand,
  browserbase,
  StagehandCreateOptionsSchema,
} from "@browserbasehq/stagehand";

import StagehandConfig from "./stagehand.config.js";
import chalk from "chalk";
import { main } from "./main.js";
import boxen from "boxen";
import Browserbase from "@browserbasehq/sdk";
import fs from "fs";
import { parseLicenseRecords } from "./license-records.js";

async function CreateSession(
  captchaImageSelector: string,
  captchaInputSelector: string,
) {
  const bb = new Browserbase({
    apiKey: process.env["BROWSERBASE_API_KEY"]!,
  });
  // Create a new session
  console.log(captchaImageSelector);
  console.log(captchaInputSelector);
  const session = await bb.sessions.create({
    browserSettings: {
      verified: true,
      // @ts-ignore
      captchaImageSelector: captchaImageSelector,
      // @ts-ignore
      captchaInputSelector: captchaInputSelector,
    },
    proxies: true,
  });

  return session;
}

async function run(sessionID: string, testCase: Record<string, string>) {
  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await browserbase.connect({
        apiKey: process.env.BROWSERBASE_API_KEY!,
        sessionId: sessionID,
      }),
    }),
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
    LicenseRecord: testCase,
  });
  await stagehand.close();
  await stagehand.browser.close();
  console.log(
    `\n🤘 Thanks for using Stagehand! Create an issue if you have any feedback: ${chalk.blue(
      "https://github.com/browserbase/stagehand/issues/new",
    )}\n`,
  );
}

const testCases = fs.readFileSync("test_cases.csv", "utf8");
const testCasesDictionary = parseLicenseRecords(testCases);

// index through the list of test cases and run the test case
for (const testCase of testCasesDictionary) {
  // Create session here
  const session = await CreateSession(
    testCase.CaptchaImage,
    testCase.CaptchaInput,
  );
  const sessionID = session.id;
  await run(sessionID, testCase);
}
