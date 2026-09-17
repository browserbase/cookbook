import { z } from "zod";

/**
 * Typed output for the no-export customer scrape. The runner auto-detects this file, passes it to the
 * agent as `output`, and writes the structured result to <short>.output.json. Fields are the standard
 * Platform A customer-directory columns — adjust to whatever the page actually shows.
 */
export default z.object({
  customers: z.array(
    z.object({
      name: z.string().describe("Customer name"),
      email: z.string().describe("Email, empty string if none"),
      phone: z.string().describe("Phone number, empty string if none"),
      marketingConsent: z
        .string()
        .describe(
          "Marketing/subscription consent flag if the directory exposes one: 'true' | 'false'; " +
            "empty string when not shown (reliable source is the customer API/export — see prompt note)",
        ),
    }),
  ),
  count: z.number().describe("Number of customers extracted"),
});
