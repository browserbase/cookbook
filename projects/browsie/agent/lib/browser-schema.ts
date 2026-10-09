import { z } from "zod";

export const browserRefActionSchema = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("click"), id: z.string().min(1) }),
  z.strictObject({ op: z.literal("hover"), id: z.string().min(1) }),
  z.strictObject({ op: z.literal("fill"), id: z.string().min(1), value: z.string() }),
  z.strictObject({
    op: z.literal("type"),
    id: z.string().min(1),
    text: z.string(),
    delay: z.number().nonnegative().optional(),
  }),
  z.strictObject({ op: z.literal("press"), id: z.string().min(1), key: z.string().min(1) }),
  z.strictObject({
    op: z.literal("select"),
    id: z.string().min(1),
    values: z.union([z.string(), z.array(z.string()).min(1)]),
  }),
]);

export const browserRunInputSchema = z
  .strictObject({
    code: z.string().min(1).optional(),
    actions: z.array(browserRefActionSchema).min(1).optional(),
  })
  .refine((input) => (input.code === undefined) !== (input.actions === undefined), {
    message: "run requires exactly one of code or actions",
  });

export type BrowserRefAction = z.infer<typeof browserRefActionSchema>;
export type BrowserRunInput =
  { code: string; actions?: never } | { code?: never; actions: BrowserRefAction[] };

export const BROWSER_RUN_TOOL_DESCRIPTION =
  'Browse and automate websites in the persistent browser by executing JavaScript against a Playwright-shaped API. The code runs inside an async function with page, context, and browser in scope (Playwright Page, BrowserContext, and Browser); use await directly and return a JSON-serializable value when useful. Navigate with await page.goto("https://example.com"); there is no separate navigate or start tool. Alternatively, provide a batch of actions using IDs from the latest snapshot. Provide exactly one of code or actions. Each action must use "op" (never "kind") and "id" (never "ref"). Copy the bracketed snapshot ID as a string. Examples: {"actions":[{"op":"click","id":"1-42"}]}, {"actions":[{"op":"fill","id":"2-14","value":"Miami"}]}, {"actions":[{"op":"select","id":"3-9","values":"Lowest price"}]}. Use code for navigation, multi-step logic, waits, and data extraction.';
