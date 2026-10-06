import { defineTool, toolOutput } from "eve/tools";
import { z } from "zod";

import { listBrowserContexts } from "../lib/browser-runtime";

export default defineTool({
  description:
    "List reusable Browserbase Contexts that Browsie can select for a later browser task. Context IDs are safe metadata, not credentials.",
  inputSchema: z.object({}),
  async execute() {
    const contexts = await listBrowserContexts();
    return {
      contexts: contexts.map(({ id, name, selected, writerActive }) => ({
        id,
        name,
        selected,
        writerActive,
      })),
    };
  },
  toModelOutput(output) {
    return toolOutput.json(output);
  },
});
