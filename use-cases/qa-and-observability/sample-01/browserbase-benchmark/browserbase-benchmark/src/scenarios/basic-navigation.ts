/**
 * Basic Navigation scenario — the canonical Browserbase vs self-hosted benchmark.
 *
 * Measures the four most common browser automation operations after session init:
 *   goto       — navigate to the target URL (page load over CDP)
 *   screenshot — capture a JPEG (pure CDP round-trip, no LLM)
 *   extract    — LLM-powered DOM extraction
 *   act        — LLM-powered click/interaction
 *
 * The `init` step (browser session startup) is always measured by the runner
 * before these steps run — it is not included here.
 *
 * Set BENCHMARK_SITES in .env or pass --sites on the CLI to control which URLs
 * are tested. Set browserOnly=true (via --browser-only or the dashboard checkbox)
 * to skip the LLM-powered extract and act steps for faster pure-CDP testing.
 */

import type { Scenario } from "../types.js";

export const scenario: Scenario = {
  name: "basic-navigation",
  description: "Navigates to a URL then measures screenshot, LLM extraction, and LLM interaction overhead",
  steps: [
    {
      name: "goto",
      async run(_stagehand, page, { site }) {
        await page.goto(site, { waitUntil: "domcontentloaded" });
      },
    },
    {
      // Pure CDP round-trip — JPEG minimises encoding time vs PNG.
      // Isolates the cost of transferring rendered pixels over IPC (local)
      // vs network (Browserbase).
      name: "screenshot",
      async run(_stagehand, page) {
        await page.screenshot({ type: "jpeg" });
      },
    },
    {
      name: "extract",
      async run(stagehand, _page, { browserOnly }) {
        if (browserOnly) return;
        (await stagehand.extract("Extract the page title and first 3 navigation links")).data;
      },
    },
    {
      name: "act",
      async run(stagehand, _page, { browserOnly }) {
        if (browserOnly) return;
        try {
          await stagehand.act("Click the first navigation link");
        } catch {
          // Some pages may not have a clickable nav link — don't fail the run
        }
      },
    },
  ],
};
