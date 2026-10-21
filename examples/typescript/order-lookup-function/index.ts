import "dotenv/config";
import { defineFn } from "@browserbasehq/sdk-functions";
import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import { chromium, type Browser } from "playwright-core";
import { z } from "zod/v4";

const origin = "https://admin-demo.nopcommerce.com";
// browse cloud extensions upload node_modules/@browserbasehq/stagehand/dist/assets/stagehand-extension.zip
const extensionId = "REPLACE_WITH_UPLOADED_STAGEHAND_EXTENSION_ID";
const parametersSchema = z.object({ orderId: z.string().regex(/^[1-9]\d{0,8}$/) }).strict();
const orderSchema = z.object({
  orderId: z.string(),
  orderStatus: z.string(),
  paymentStatus: z.string(),
  shippingStatus: z.string(),
  orderTotal: z.string(),
  trackingNumber: z.string().nullable(),
  trackingUrl: z.string().nullable(),
});

type LookupResult =
  | { status: "found"; order: z.infer<typeof orderSchema>; replayUrl: string }
  | { status: "invalid_input" | "missing_secrets" | "order_mismatch"; replayUrl: string }
  | { status: "unavailable"; stage: string; replayUrl: string };

export default defineFn(
  "nopcommerce-order-lookup",
  async (context, params): Promise<LookupResult> => {
    const input = parametersSchema.safeParse(params);
    const replayUrl = `https://www.browserbase.com/sessions/${context.session.id}`;
    if (!input.success) return { status: "invalid_input", replayUrl };
    // Create values at interactive CLI prompts, never in source or invocation params:
    // browse cloud secrets create BROWSERBASE_API_KEY
    // browse cloud secrets create NOPCOMMERCE_EMAIL
    // browse cloud secrets create NOPCOMMERCE_PASSWORD
    // browse functions secrets attach <function-id> <secret-id> (repeat for all three)
    // browse functions secrets list <function-id>
    const secret = (name: string) => context.secrets?.[name] ?? process.env[name];
    const apiKey = secret("BROWSERBASE_API_KEY");
    const email = secret("NOPCOMMERCE_EMAIL");
    const password = secret("NOPCOMMERCE_PASSWORD");
    if (!apiKey || !email || !password) return { status: "missing_secrets", replayUrl };
    let stage = "connect";
    let browser: Awaited<ReturnType<typeof browserbase.connect>> | undefined;
    let stagehand: Stagehand | undefined;
    let playwright: Browser | undefined;
    try {
      browser = await browserbase.connect({ apiKey, sessionId: context.session.id });
      stagehand = await Stagehand.create({ browser });
      const page = await browser.context.activePage();
      if (!page) throw new Error("No active page");
      playwright = await chromium.connectOverCDP(context.session.connectUrl);
      const form = playwright.contexts()[0]?.pages()[0];
      if (!form) throw new Error("No active page");
      form.setDefaultTimeout(30_000);
      stage = "login";
      await form.goto(`${origin}/login`);
      await form.locator('input[type="email"]').waitFor({ timeout: 60_000 });
      const { data: actions } = await stagehand.observe(
        "Find only the Log in button that submits this login form.",
        { page },
      );
      const [submit] = actions;
      if (actions.length !== 1 || !submit?.selector) throw new Error("Ambiguous login button");
      if (new URL(form.url()).origin !== origin) throw new Error("Unexpected login origin");
      // Fill directly after discovery so credential values never enter an AI instruction.
      await form.locator('input[type="email"]').fill(email);
      await form.locator('input[type="password"]').fill(password);
      await form.locator(submit.selector).click();
      await form.getByRole("heading", { name: "Dashboard", exact: true }).waitFor();
      stage = "lookup";
      await form.goto(`${origin}/Admin/Order/List`);
      await form.locator("#GoDirectlyToCustomOrderNumber").fill(input.data.orderId);
      await form.getByRole("button", { name: "Go", exact: true }).click();
      await form.getByRole("heading", { name: /Edit order details/ }).waitFor();
      if (new URL(form.url()).origin !== origin) throw new Error("Unexpected order origin");
      stage = "extract";
      const { data: order } = await stagehand.extract(
        "Read the displayed order number, order status, payment status, shipping status and order total. Return tracking number and tracking URL only if explicitly displayed; otherwise null. Do not infer delivery dates or delay reasons. Do not extract customer names, email addresses, billing addresses or payment details.",
        orderSchema,
        { page },
      );
      if (order.orderId !== input.data.orderId) return { status: "order_mismatch", replayUrl };
      return { status: "found", order, replayUrl };
    } catch {
      // SDK errors may contain requests or page data; expose only the failed step.
      return { status: "unavailable", stage, replayUrl };
    } finally {
      // Cleanup must not hide a useful result. The Functions runtime owns the session lifecycle.
      for (const close of [
        () => stagehand?.close(),
        () => playwright?.close(),
        () => browser?.close(),
      ]) {
        try {
          await close();
        } catch {
          console.warn("Browser connection cleanup failed");
        }
      }
    }
  },
  {
    parametersSchema,
    sessionConfig: {
      extensionId,
      proxies: true,
      browserSettings: { recordSession: true, logSession: false },
    },
  },
);
