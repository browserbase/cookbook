/**
 *
 * Run using
 * npx tsx adv_stealth_sdk.ts
 *
 **/

import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";
import * as dotenv from "dotenv";
dotenv.config();

const BROWSERBASE_API_KEY = process.env["BROWSERBASE_API_KEY"]!;
const BROWSERBASE_PROJECT_ID = process.env["BROWSERBASE_PROJECT_ID"]!;

const bb = new Browserbase({
  apiKey: BROWSERBASE_API_KEY,
});

(async () => {
  // Create a new session
  const session = await bb.sessions.create({
    projectId: BROWSERBASE_PROJECT_ID,
    browserSettings: {
      // @ts-ignore
      advancedStealth: true,
      keepAlive: true,
    },
    region: "us-east-1",
    proxies: true,
  });

  // Connect to the session
  const browser = await chromium.connectOverCDP(session.connectUrl);

  // Getting the default context to ensure the sessions are recorded.
  const defaultContext = browser.contexts()[0];
  const page = defaultContext?.pages()[0];

  console.log(
    `Session started: https://browserbase.com/sessions/${session.id}`,
  );
  await page.goto(
    "https://identity.onehealthcareid.com/oneapp/index.html#/login",
  );

  // input username into <input id ="username"
  await page.locator("input[id='username']").fill("brow123");

  // await page.waitForTimeout(30000);

  // await page.close();
  // await browser.close();
  console.log(
    `Session complete! View replay at https://browserbase.com/sessions/${session.id}`,
  );
})().catch((error) => console.error(error.message));
