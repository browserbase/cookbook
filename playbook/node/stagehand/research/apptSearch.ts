import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod/v4"; // used for extract schema

async function main() {
  const browser = await browserbase.launch({
    apiKey: process.env.BROWSERBASE_API_KEY!,
  });
  const stagehand = await Stagehand.create({ browser });

  // Initialize the stagehand instance

  const page = (await browser.context.pages())[0];

  // Navigate to the page + take some action
  await page.goto("https://aryanashville.com/");
  await stagehand.act("close pop up");

  await stagehand.act("Click on the 'Floorplans' from the navigation menu");
  const floorplans = (
    await stagehand.extract(
      "Extract the floorplans from the page",
      z.object({
        floorplans: z.array(
          z.object({
            floorplan_name: z.string(),
            floorplan_price: z.string(),
            floorplan_sqft: z.string(),
            floorplan_bedrooms: z.string(),
            floorplan_bathrooms: z.string(),
            floorplan_link: z.string(),
          }),
        ),
      }),
    )
  ).data;
  console.log(floorplans);

  // Close the stagehand instance
  await stagehand.close();
  await browser.close();
}

main();
