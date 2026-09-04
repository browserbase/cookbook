import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import StagehandConfig from "./stagehand.config.js";
import chalk from "chalk";
import { input_fields } from "./find_fields.js";
import { pull_data } from "./pull_data.js";
import boxen from "boxen";

async function run() {
  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse(await StagehandConfig()),
  );

  if (stagehand.browser.sessionId) {
    console.log(
      boxen(
        `View this session live in your browser: \n${chalk.blue(
          `https://browserbase.com/sessions/${stagehand.browser.sessionId}`,
        )}`,
        {
          title: "Browserbase",
          padding: 1,
          margin: 3,
        },
      ),
    );
  }

  const page = (await stagehand.browser.context.activePage())!;
  const context = stagehand.browser.context;

  const url = "https://rcp.estado.pr.gov/en/search";
  console.log("Getting input fields for " + url);

  await input_fields({
    page,
    context,
    stagehand,
    url,
    output_csv: "csv_files/output_fields.csv",
  });

  ////////////////////////////////////////////////////////////////
  ///////////// USER MANUALLY INPUTS THE FIELDS /////////////////
  //////////// Example: user_input_rcp_data.csv /////////////////
  ///////////////////////////////////////////////////////////////

  await pull_data({
    page,
    context,
    stagehand,
    url,
    user_input_csv: "csv_files/rcp_user_input_data.csv",
    output_csv: "csv_files/rcp_results.csv",
  });

  await stagehand.close();
  await stagehand.browser.close();
}

run();
