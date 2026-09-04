import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
/**
 * Local Chromium competitor — self-hosted browser running on the same machine
 * as the agent. Stagehand communicates via local IPC (near-zero transport cost).
 *
 * This represents the DIY baseline: running Chromium co-located on Render Pro,
 * an EC2 instance, or any other self-managed compute.
 */

import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import type { Competitor } from "../types.js";
import { resolveChromiumPath } from "../chromium.js";

// Chrome flags required for headless operation in container environments
const CONTAINER_CHROME_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",  // use /tmp instead of /dev/shm (limited in containers)
  "--disable-gpu",
];

export const competitor: Competitor = {
  name: "local-chromium",
  label: "Local Chromium",

  async createStagehand(resources) {
    const executablePath = await resolveChromiumPath();
    resources.signal.throwIfAborted();
    const browser = await resources.own(await localBrowser.launch({
      executablePath,
      headless: true,
      args: CONTAINER_CHROME_ARGS,
    }));
    return resources.own(await Stagehand.create(StagehandCreateOptionsSchema.parse({
      browser,
      model: { modelName: process.env.BENCHMARK_MODEL ?? "google/gemini-2.5-flash", apiKey: process.env.GOOGLE_API_KEY },
    })));
  },
};
