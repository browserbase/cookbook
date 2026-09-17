import { browserbase, localBrowser } from "@browserbasehq/stagehand";
import dotenv from "dotenv";

dotenv.config();

const StagehandConfig = async () => {
  const contextId = process.env.BROWSERBASE_CONTEXT_ID;
  return {
    browser: await browserbase.launch({
      apiKey: process.env.BROWSERBASE_API_KEY!,
      browserSettings: {
        ...(contextId ? { context: { id: contextId, persist: true } } : {}),
        // @ts-ignore
        keepAlive: true,
        proxy: true,
      },
    }),
    model: { modelName: "openai/gpt-4o", apiKey: process.env.OPENAI_API_KEY },
    domSettleTimeoutMs: 30_000,
    cache: false,
  };
};

export default StagehandConfig;
