import { browserbase, localBrowser } from "@browserbasehq/stagehand";
import dotenv from "dotenv";
false;
false;

dotenv.config();

const StagehandConfig = async () => ({
  browser: await browserbase.launch({
    apiKey: process.env.BROWSERBASE_API_KEY!,
    ...{
      browserSettings: {
        verified: true,
      },
      proxies: true,
      region: "us-east-1",
    },
  }),
  model: { modelName: "openai/gpt-4o", apiKey: process.env.OPENAI_API_KEY },
  domSettleTimeoutMs: 30_000,
  cache: undefined,
});

export default StagehandConfig;
