import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import boxen from "boxen";
import chalk from "chalk";
import { z } from "zod/v4"; // used for extract schema

const LicenseRecords = [
  {
    Site: "https://pod-search.kalmservices.net/",
    FirstName: "Ronald",
    LastName: "Agee",
    LicenseNumber: "346",
  },
];

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

  for (const LicenseRecord of LicenseRecords) {
    // Navigate to the page + take some action
    await page.goto(LicenseRecord.Site);

    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);

    const inputs = (
      await stagehand.observe(
        "Input the first name, last name, and license number into the page: " +
          JSON.stringify(LicenseRecord),
      )
    ).data;
    console.log(inputs);

    for (const input of inputs) {
      if (input.method == "fill") {
        await stagehand.act(input);
      } else {
        // pass
      }
    }

    await stagehand.act("Click the search button");

    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);

    const results = (
      await stagehand.extract(
        "Extract ALL the license verification results from the page, including name, license number and status",
        z.object({
          list_of_licenses: z.array(
            z.object({
              name: z.string(),
              license_number: z.string(),
              status: z.string(),
              more_info_url: z.string(),
            }),
          ),
        }),
      )
    ).data;

    console.log(
      boxen(`Results: \n${chalk.blue(JSON.stringify(results))}`, {
        title: "Results",
        padding: 1,
        margin: 3,
      }),
    );
  }

  // Close the stagehand instance
  await stagehand.close();
  await browser.close();
}

main();
