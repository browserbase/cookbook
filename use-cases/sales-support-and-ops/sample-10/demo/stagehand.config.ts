import { browserbase, localBrowser } from "@browserbasehq/stagehand";
import dotenv from "dotenv";

dotenv.config();

const StagehandConfig = async () => ({
  browser: await localBrowser.launch({
    viewport: {
      width: 1024,
      height: 768,
    },
  }),
  model: {
    modelName: "google/gemini-2.0-flash",
    apiKey: process.env.GOOGLE_API_KEY,
  },
  domSettleTimeoutMs: 30_000,
});

export default StagehandConfig;
