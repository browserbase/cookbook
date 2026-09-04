import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
/**
 * Browserbase competitor — managed remote browser infrastructure.
 *
 * Stagehand connects via CDP over the network to a Browserbase-provisioned
 * browser in the configured AWS region. The init phase includes session
 * creation + remote connection latency.
 */

import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import type { Competitor } from "../types.js";

export const competitor: Competitor = {
  name: "browserbase",
  label: "Browserbase",

  async createStagehand(resources) {
    resources.signal.throwIfAborted();
    const browser = await resources.own(await browserbase.launch({
      apiKey: process.env.BROWSERBASE_API_KEY!,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      region: (process.env.BROWSERBASE_REGION ?? "us-west-2") as
        | "us-east-1" | "us-west-2" | "eu-central-1" | "ap-southeast-1",
      browserSettings: { recordSession: false },
    }));
    return resources.own(await Stagehand.create(StagehandCreateOptionsSchema.parse({
      browser,
      model: { modelName: process.env.BENCHMARK_MODEL ?? "google/gemini-2.5-flash", apiKey: process.env.GOOGLE_API_KEY },
    })));
  },
};
