/**
 * 🤘 Welcome to Stagehand!
 *
 * TO RUN THIS PROJECT:
 * ```
 * npm install
 * npm run start
 * ```
 *
 * To edit config, see `stagehand.config.ts`
 *
 */
import { Page, BrowserContext, Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import chalk from "chalk";
import dotenv from "dotenv";
import readline from "readline";

dotenv.config();

export async function main({
  page,
  context,
  stagehand,
}: {
  page: Page; // Playwright Page with act, extract, and observe methods
  context: BrowserContext; // Playwright BrowserContext
  stagehand: Stagehand; // Stagehand instance
}) {
  // Function to prompt user input
  function askQuestion(query: string) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  // Add your code here
  await page.goto("https://health.example.invalid/member/benefits");
  const loginValues = (
    await stagehand.observe(
      `find the username and password fields and fill them in with the following values: username: ${process.env.HEALTH_PORTAL_USERNAME} and password: ${process.env.HEALTH_PORTAL_PASSWORD}`,
      { page: page },
    )
  ).data;

  for (const candidate of loginValues) {
    await stagehand.act(candidate, { page: page });
  }

  await stagehand.act("click Log In", { page: page });

  // Click on the option to receive the 2FA code as a text message
  await stagehand.act("click the first option to send code to phone number", {
    page: page,
  });
  const sendCodeValues = (
    await stagehand.observe("find the send button and click it", { page: page })
  ).data;
  await stagehand.act(sendCodeValues[0], { page: page });
  // console log sending code
  console.log("Sending code to phone number");

  // Prompt the user to enter the 2FA code from their phone
  const twoFACode = await askQuestion(
    "Please enter the 2FA code sent to your phone: ",
  );
  await stagehand.act(
    `type in code: ${twoFACode}. Then select the first option to remember my device. Then click Next.`,
    { page: page },
  );
  // wait 10 seconds
  await new Promise((resolve) => setTimeout(resolve, 10000));
  7007;
  console.log("Moving on to next step.");

  // click on benefits and coverage using ID: benefits_card_button
  await page.locator("#benefits_card_button").click();

  const insurance_info = (
    await stagehand.extract(
      "extract the Member ID and Group Number",
      z.object({
        memberID: z.string(),
        groupNumber: z.string(),
      }),
      { page: page },
    )
  ).data;

  console.log(insurance_info);

  // COOKBOOK_EXAMPLE

  // await page.goto("https://example.invalid/sign-in/id?next=%2Flogin%3Fnext%3D%2Fdashboard");
  // await page.waitForTimeout(5000);
  // const portalLoginValues = await page.observe({instruction: `find the email field and fill in with the following values: email: ${process.env.MEMBER_PORTAL_USERNAME}`,
  //   returnAction: true,
  //   onlyVisible: false});

  // await page.act(portalLoginValues[0]);
  // await page.act({ action: "click continue" });

  // const portalPasswordValues = await page.observe({instruction: `find the password field and fill in with the following values: password: ${process.env.MEMBER_PORTAL_PASSWORD}`,
  //   returnAction: true,
  //   onlyVisible: false});

  // await page.act(portalPasswordValues[0]);
  // // wait 5 seconds
  // await new Promise(resolve => setTimeout(resolve, 5000));
  // await page.act({ action: "click Sign in" });
  // await page.act({ action: "click My Benefits" });

  // // await page.act({ action: `type in email: ${process.env.MEMBER_PORTAL_USERNAME}` });
  // // await page.act({ action: "click continue" });
  // // await page.act({ action: `type in password: ${process.env.MEMBER_PORTAL_PASSWORD}` });
  // // await page.act({ action: "click Sign in" });
  // // await page.act({ action: "click My Benefits" });
  // const portal_info = await page.extract({
  //   instruction: "extract the Medical Member ID and Group Number",
  //   schema: z.object({
  //     memberID: z.string(),
  //     groupNumber: z.string(),
  //   }),
  // });

  // // Log the medical_info
  // console.log(portal_info);

  // // log the portal_info and insurance_info
  // console.log(portal_info);
  // console.log(insurance_info);

  // if (portal_info === insurance_info) {
  //   console.log("the cookbook example and Insurance info are the same.");
  // } else {
  //   console.log("the cookbook example and Insurance info are not the same.");
  // }
}
