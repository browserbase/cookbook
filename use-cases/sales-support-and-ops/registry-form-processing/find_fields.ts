import { Page, BrowserContext, Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import chalk from "chalk";
import dotenv from "dotenv";
import OpenAI from "openai/index.mjs";
import fs from "fs";
import path from "path";

dotenv.config();

export async function input_fields({
  page,
  context,
  stagehand,
  url,
  output_csv,
}: {
  page: Page; // Playwright Page with act, extract, and observe methods
  context: BrowserContext; // Playwright BrowserContext
  stagehand: Stagehand; // Stagehand instance
  url: string; // the url to scrape
  output_csv: string; // the name of the csv file to output to
}) {
  /////////////////// PART 1: GET THE FIELDS ///////////////////
  await page.goto(url);

  const fields = (
    await stagehand.observe("Find all of the fields that take an input value", {
      page: page,
    })
  ).data;
  console.log(fields);

  // use open AI to generate the values for the fields
  const openai = new OpenAI();
  let csvContent = [];

  for (const field of fields) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "developer",
          content:
            "You are a simplifing agent. You are given a description of a field and you are tasked with generating a label for the field. The label should be a single word or phrase that describes the field. For example, if the description is 'This is a text input field where users can enter specific filings to search for.', the label should be 'Filing Name'.",
        },
        {
          role: "user",
          content: `Use the description of the field to generate a label for the field. The label should be a single word or phrase that describes the field.
                The description of the field is: ${JSON.stringify(field.description)}`,
        },
      ],
      store: true,
    });
    const field_name = completion.choices[0].message.content;
    console.log(field_name);

    // append the field name to the csv
    csvContent.push({ field_name });
  }

  // drop duplicates
  csvContent = csvContent.filter(
    (item, index, self) =>
      index === self.findIndex((t) => t.field_name === item.field_name),
  );
  console.log(csvContent);

  const csvHeader = csvContent.map((item) => item.field_name).join(",");

  // Write to a CSV file
  fs.writeFileSync(output_csv, csvHeader, "utf8");

  console.log(`CSV file saved to ${output_csv}`);
}
