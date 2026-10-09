import { defineTool, toolOutput } from "eve/tools";

import { runBrowserOperation, runCancelableBrowserWork } from "../lib/browser-runtime";
import { BROWSER_RUN_TOOL_DESCRIPTION, browserRunInputSchema } from "../lib/browser-schema";

export default defineTool({
  description: BROWSER_RUN_TOOL_DESCRIPTION,
  inputSchema: browserRunInputSchema,
  async execute(input, ctx) {
    const runInput = input.code !== undefined ? { code: input.code } : { actions: input.actions! };
    return runCancelableBrowserWork(ctx.session.id, ctx.abortSignal, () =>
      runBrowserOperation(ctx.session.id, (browser) => browser.run(runInput)),
    );
  },
  toModelOutput(output) {
    return toolOutput.json(output.result);
  },
});
