import { defineTool, toolOutput } from "eve/tools";
import { z } from "zod";

import { nativeVault, onePasswordVault } from "../../server/vault/index.js";

export default defineTool({
  description:
    "List safe login metadata and opaque handles. No secret values are returned. Choose only an item whose allowedHosts contains the current page host.",
  inputSchema: z.object({
    provider: z.enum(["native", "onepassword"]).optional(),
  }),
  async execute({ provider }) {
    const providers = provider ? [provider] : (["native", "onepassword"] as const);
    const items = [];
    for (const id of providers) {
      const vault = id === "native" ? nativeVault : onePasswordVault;
      const status = await vault.status();
      if (status.healthy) items.push(...(await vault.list()));
    }
    return { items };
  },
  toModelOutput(output) {
    return toolOutput.json(output);
  },
});
