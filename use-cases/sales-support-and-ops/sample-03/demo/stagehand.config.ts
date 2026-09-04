import { browserbase, localBrowser } from "@browserbasehq/stagehand";
import dotenv from "dotenv";

dotenv.config();

const StagehandConfig = async () => ({
  browser: await localBrowser.launch({ headless: false }),
  model: { modelName: "openai/gpt-4o", apiKey: process.env.OPENAI_API_KEY },
  domSettleTimeoutMs: 30_000,
  cache: false,
});

export default StagehandConfig;
