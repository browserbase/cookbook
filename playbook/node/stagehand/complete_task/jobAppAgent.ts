import { createBrowserAgent, resolveAgentModel } from "../browser-agent.js";
import dotenv from "dotenv";
import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import boxen from "boxen";
import chalk from "chalk";
import { z } from "zod/v4"; // used for extract schema

const profile = {
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@example.com",
  headline: "Staff Software Engineer",
  phone: "1234567890",
  address: "Jersey City, New Jersey, United States",
  resumePath: "./resume.pdf",
};

async function main() {
  dotenv.config({ path: new URL(".env", import.meta.url) });
  const model = resolveAgentModel();
  if (!process.env.BROWSERBASE_API_KEY) throw new Error("BROWSERBASE_API_KEY is required");
  const browser = await browserbase.launch({
    apiKey: process.env.BROWSERBASE_API_KEY!,
  });
  let stagehand: Stagehand | undefined;
  try {
    stagehand = await Stagehand.create({ browser });
    const page = (await browser.context.pages())[0];
    const agent = createBrowserAgent(stagehand, browser, [profile.resumePath], model);
    await page.goto(
      "https://jobs.workable.com/view/dbvD6SyquGD1b4d8FZtsLw/staff-software-engineer%2C-devices---(remote---new-york)-in-new-york-at-jobgether",
    );
    await agent.generate({
      prompt: `Fill in the fields with the following information: ${JSON.stringify(profile)}. Do not submit the application.`,
    });
  } finally {
    try { await stagehand?.close(); } finally { await browser.close(); }
  }

  // DANGER!!
  // await page.act("click the submit button");
}

(async () => {
  await main();
})();
