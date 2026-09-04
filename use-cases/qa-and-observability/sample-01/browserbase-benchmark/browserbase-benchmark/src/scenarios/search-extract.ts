/**
 * Search + Extract scenario — a common AI agent pattern: navigate to a site,
 * perform a search, and extract structured data from the results.
 *
 * Steps:
 *   goto    — navigate to the target URL (triggers W3C nav timing collection)
 *   search  — LLM-powered: find and type into the search box
 *   extract — LLM-powered: pull structured results from the page
 *
 * Both LLM steps are skipped when --browser-only is set, so this scenario
 * also works as a fast pure-CDP baseline.
 */

import type { Scenario } from "../types.js";

export const scenario: Scenario = {
  name: "search-extract",
  description: "Navigates to a URL, performs a search, and extracts structured results",
  steps: [
    {
      name: "goto",
      async run(_stagehand, page, { site }) {
        await page.goto(site, { waitUntil: "domcontentloaded" });
      },
    },
    {
      name: "search",
      async run(stagehand, _page, { browserOnly }) {
        if (browserOnly) return;
        try {
          await stagehand.act("Find the search box and type 'test'");
        } catch {
          // Not every site has a search box — don't fail the run
        }
      },
    },
    {
      name: "extract",
      async run(stagehand, _page, { browserOnly }) {
        if (browserOnly) return;
        (await stagehand.extract("Extract the first 3 results or items visible on the page")).data;
      },
    },
  ],
};
