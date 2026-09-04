import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import { runBrowserTask } from "../browser-task";
import { BROWSERBASE_API_KEY } from "./config";

export async function runSessionTask(
  sessionId: string,
  instruction: string,
  maxSteps = 60,
) {
  const browser = await browserbase.connect({
    apiKey: BROWSERBASE_API_KEY,
    sessionId,
  });
  const stagehand = await Stagehand.create({ browser });
  try {
    const result = await runBrowserTask(stagehand, { instruction, maxSteps });
    return {
      success: result.success,
      message: result.message,
      steps: result.actions.length,
    };
  } finally {
    // The Functions runtime owns this session and still needs its downloads.
    await stagehand.close();
  }
}
