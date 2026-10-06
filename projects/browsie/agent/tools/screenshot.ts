import { defineTool, toolOutput } from "eve/tools";
import { z } from "zod";

import { runBrowserOperation, runCancelableBrowserWork } from "../lib/browser-runtime";

export default defineTool({
  description:
    "Capture the visible page when layout, images, or visual state are important. The Browsie workbench shows the image.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    return runCancelableBrowserWork(ctx.session.id, ctx.abortSignal, () =>
      runBrowserOperation(ctx.session.id, (browser) => browser.screenshot(), true),
    );
  },
  toModelOutput(output) {
    return toolOutput.json({
      mediaType: output.result.mediaType,
      url: output.result.url,
    });
  },
});
