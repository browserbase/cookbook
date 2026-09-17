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
  const departureDate = "02/01/2025";
  const returnDate = "02/08/2025";

  await page.goto("https://www.alaskaair.com/");

  // Select the origin
  await stagehand.act(`type in starting location/origin: ${origin}`);
  await stagehand.act(`select ${origin} from the origin options`);

  // Select the destination
  await stagehand.act(`type in destination: ${destination}`);
  await stagehand.act(`select ${destination} from the destination options`);

  // Select the departure date
  await stagehand.act(
    `select ${departureDate} from the departure date options`,
  );

  // Select the return date
  await stagehand.act(`select ${returnDate} from the return date options`);

  // Click the search for flights button
  await stagehand.act("click search for flights");

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
})().catch(console.error);
