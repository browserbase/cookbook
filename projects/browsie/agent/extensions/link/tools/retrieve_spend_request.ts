import { retrieve_spend_request } from "@stripe/link-integrations-eve/tools";
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  ...retrieve_spend_request,
  description:
    "Retrieve a Link spend request status without returning card numbers or payment tokens. Use link__secure_checkout after the card request is approved.",
  inputSchema: z.strictObject({ id: z.string().min(1) }),
  execute(input, ctx) {
    return retrieve_spend_request.execute(input, ctx);
  },
});
