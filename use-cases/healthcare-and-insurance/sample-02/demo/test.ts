import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";
import { config } from "dotenv";
config();

async function createSession() {
  const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });
  const session = await bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    // Add configuration options here
    browserSettings: {
      advancedStealth: true,
      // @ts-ignore
      captchaImageSelector: "#imgcap", // "img[src*='Captcha']",
      // @ts-ignore
      captchaInputSelector: "#ctl00_cntbdy_txt_verify", //"input[name*='txt_verify']",
    },
  });
  return session;
}

async function test() {
  const session = await createSession();
  const browser = await chromium.connectOverCDP(session.connectUrl);

  // Getting the default context to ensure the sessions are recorded.
  const defaultContext = browser.contexts()[0];
  const page = defaultContext?.pages()[0];

  console.log(
    `View sessionreplay at https://browserbase.com/sessions/${session.id}`,
  );
  // Navigate to page
  await page.goto(
    "https://abme.igovsolution.net/online/Lookups/Individual_Lookup.aspx",
  );

  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(10000);

  console.log("Shutting down...");
  await page.close();
  await browser.close();
}
test();
