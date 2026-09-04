import { browserbase, localBrowser } from "@browserbasehq/stagehand";
import dotenv from "dotenv";

dotenv.config();

const StagehandConfig = async () => ({
  browser: await browserbase.launch({
    apiKey: process.env.BROWSERBASE_API_KEY!,
    ...{
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      browserSettings: {
        context: {
          id: "49b6424f-4c97-42ba-8693-991dc55e0498",
          persist: true,
        },
        // @ts-ignore
        keepAlive: true,
        proxy: true,
      },
    },
  }),
  model: { modelName: "openai/gpt-4o", apiKey: process.env.OPENAI_API_KEY },
  domSettleTimeoutMs: 30_000,
  cache: false,
});

export default StagehandConfig;
