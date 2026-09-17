import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod/v4";
import chalk from "chalk";
import dotenv from "dotenv";
import boxen from "boxen";

dotenv.config();

async function main() {
  const browser = await browserbase.launch({
    apiKey: process.env.BROWSERBASE_API_KEY!,
  });
  const stagehand = await Stagehand.create({ browser });

  const page = (await browser.context.pages())[0];
  const context = browser.context;

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
  // Set the origin and destination
  const origin = "SFO";
  const destination = "LAX";

  await page.goto("https://www.southwest.com/");
  await stagehand.act("select the round trip option");
  await stagehand.act(`type in origin: ${origin}`);
  await stagehand.act(`select ${origin} from the origin menu options`);
  await stagehand.act(`type in destination: ${destination}`);
  await stagehand.act(
    `select ${destination} from the destination menu options`,
  );
  await stagehand.act("click the departure date of the first of next month");
  await stagehand.act("click the return date of the eighth of the month");
  await stagehand.act("click search for flights");
  await stagehand.act("select only the non stop flights");

  // get array of flight data
  const flightData = (
    await stagehand.extract(
      "extract all of the flight data from the page, only include the flight number, departure and arrival times, and the price",
      z.object({
        flights: z.array(
          z.object({
            flight_number: z.string(),
            departure_time: z.string(),
            arrival_time: z.string(),
            price: z.string(),
          }),
        ),
      }),
    )
  ).data;

  console.log(flightData);

  await stagehand.close();
  await browser.close();
}

(async () => {
  await main();
  console.log(
    `\n🤘 Thanks for using Stagehand! Create an issue if you have any feedback: ${chalk.blue(
      "https://github.com/browserbase/stagehand/issues/new",
    )}\n`,
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
