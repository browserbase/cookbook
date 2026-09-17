import { browserbase, localBrowser } from "@browserbasehq/stagehand";
import dotenv from "dotenv";
false;
false;

dotenv.config();

const StagehandConfig = async () => ({
  browser: await localBrowser.launch({ headless: false }),
  model: {
    modelName: "openai/gpt-4o-mini",
    apiKey: process.env.OPENAI_API_KEY,
  },
  domSettleTimeoutMs: 30_000,
  cache: undefined,
});

export default StagehandConfig;
