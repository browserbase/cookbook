import { defineTool, toolOutput } from "eve/tools";
import { z } from "zod";

import { configureBrowserProxyLocation } from "../lib/browser-runtime";

export default defineTool({
  description:
    "Set the Browserbase managed proxy location before the first browser action. Use this whenever the user asks to browse from a country, state, or city. Country must be a two-letter code, such as US or GB.",
  inputSchema: z.object({
    country: z
      .string()
      .trim()
      .regex(/^[a-zA-Z]{2}$/),
    state: z.string().trim().min(1).max(32).optional(),
    city: z.string().trim().min(1).max(80).optional(),
  }),
  execute(location, ctx) {
    return configureBrowserProxyLocation(ctx.session.id, location);
  },
  toModelOutput(output) {
    return toolOutput.json(output.result);
  },
});
