import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import dotenv from "dotenv";

dotenv.config();

const browser = await browserbase.launch({
  ...{
    browserSettings: {
      extensionId: process.env.EXTENSION_ID!,
    },
  },
  apiKey: process.env.BROWSERBASE_API_KEY!,
});
const stagehand = await Stagehand.create({
  browser,
  model: {
    modelName: "openai/gpt-4o-mini",
    ...{ apiKey: process.env.MODEL_API_KEY! },
  },
});

const page = (await browser.context.pages())[0];

// log in to 1password
await page.goto(
  "chrome-extension://aeblfdkhhhdcdjpifhhbdiojplfjncoa/app/app.html#/page/welcome",
);
await stagehand.act("click the Continue button");
await stagehand.act("click the Sign in button");
await stagehand.act(`type '${process.env.PASS_USERNAME}' into the email input`);
await stagehand.act("click the Continue button");
await stagehand.act(
  `type '${process.env.PASS_SECRETKEY}' into the Secret Key input`,
);
await stagehand.act(
  `type '${process.env.PASS_PASSWORD}' into the Password input`,
);
await stagehand.act("click the Sign In button");
await page.waitForLoadState("networkidle");

// log in to browserbase using the credentials from 1password
await page.goto("https://browserbase.com/sign-in");
await page.waitForLoadState("networkidle");

await stagehand.close();
await browser.close();
