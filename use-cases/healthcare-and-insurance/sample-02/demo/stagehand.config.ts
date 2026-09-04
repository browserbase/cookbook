import { browserbase, localBrowser } from "@browserbasehq/stagehand";
import dotenv from "dotenv";
false;
false;

dotenv.config();

const StagehandConfig = async () => ({
  browser: await browserbase.launch({
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
  }),
  model: { modelName: "openai/gpt-4o", apiKey: process.env.OPENAI_API_KEY },
  domSettleTimeoutMs: 30_000,
  cache: undefined,
});

export default StagehandConfig;
