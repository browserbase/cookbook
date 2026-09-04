import { z } from "zod";

/**
 * Typed output for the services pull (catalog API replay). Matches the Sample Organization Pre-POC "Services"
 * schema: one row per service AND per service option (variant). A service with multiple Square catalog
 * variations is emitted as the parent plus one row per variant, with `parent_service_name` set on the
 * variant rows.
 *
 * NOTE (Phase B / needs a valid Square context to confirm): the exact catalog field names for
 * `processing_duration`, `trailing_buffer_duration`, and `category_name` are best-effort here — the
 * mapping reads several likely fields defensively and leaves "" when absent. Confirm against a live
 * catalog response, then tighten.
 */
export default z.object({
  services: z.array(
    z.object({
      name: z.string().describe("Service or service-option name"),
      description: z
        .string()
        .describe("Service description, empty string if none"),
      category_name: z
        .string()
        .describe("Category name, empty string if uncategorized"),
      duration: z
        .string()
        .describe("Service duration in minutes, empty string if none"),
      price: z
        .string()
        .describe(
          "Price in dollars (e.g. '100.00'), empty string if variable/none",
        ),
      price_varies: z
        .boolean()
        .describe("True if the service/variation uses variable pricing"),
      processing_duration: z
        .string()
        .describe(
          "Processing/transition time in minutes if set (best-effort), else empty string",
        ),
      trailing_buffer_duration: z
        .string()
        .describe(
          "Trailing buffer time in minutes if set (best-effort), else empty string",
        ),
      parent_service_name: z
        .string()
        .describe(
          "Parent service name when this row is a variant/option, else empty string",
        ),
    }),
  ),
  count: z
    .number()
    .describe("Number of rows returned (services plus their variants)"),
});
