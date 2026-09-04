import type { Page, BrowserContext, Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import fs from "fs";

import { parseLookupInput, tableCsv, validateColumns } from "./csv-data.js";

export async function pull_data({
  page,
  context,
  stagehand,
  url,
  user_input_csv,
  output_csv,
}: {
  page: Page;
  context: BrowserContext;
  stagehand: Stagehand; // Stagehand instance
  url: string; // the url to scrape
  user_input_csv: string; // the name of the csv file to pull from
  output_csv: string; // the name of the csv file to output to
}) {
  /////////////////// PART 2: USE THE USER INPUT TO GET THE DATA ///////////////////

  const input = await parseLookupInput(fs.readFileSync(user_input_csv, "utf8"));

  // go to the url and search for the user input
  await page.goto(url);

  // fill in the search criteria
  await stagehand.act("Fill in the search criteria", {
    page: page,
    variables: input,
  });

  // click search
  await stagehand.act("Click Search button", { page: page });

  // Pull the table information
  const result_columns = (
    await stagehand.extract(
      "Extract the names of the columns in the table",
      z.object({
        columns: z.array(z.string()),
      }),
      { page: page },
    )
  ).data;
  validateColumns(result_columns.columns);

  // make a dictionary with all of the column names as keys and the values as z.string()
  const result_schema = Object.fromEntries(result_columns.columns.map(column => [column, z.string()]));

  // Pull the content of the table
  const results = (
    await stagehand.extract(
      "Extract the table with all relevant data",
      z.object({
        results: z.array(z.object(result_schema)),
      }),
      { page: page },
    )
  ).data;

  const resultsCsvContent = await tableCsv(result_columns.columns, results.results);
  fs.writeFileSync(output_csv, resultsCsvContent, "utf8");
  console.log(`CSV file saved to ${output_csv}`);
}
