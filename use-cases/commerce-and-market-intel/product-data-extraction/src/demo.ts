import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
/**
 * Browserbase + Stagehand Demo: Retailer retail assistant AI Shopping Agent
 *
 * Single hybrid agent that:
 *  1. Opens retail assistant chat and asks for shovel recommendations
 *  2. Finds a shovel and adds it to cart
 */

import "dotenv/config";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";
import { runBrowserTask } from "./../browser-task.js";

const ResultSchema = z.object({
  magicApronResponse: z
    .string().trim().min(1)
    .describe("The full text response from retail assistant"),
  recommendations: z
    .array(
      z.object({
        name: z.string().trim().min(1).describe("Product name"),
        price: z.string().optional().describe("Price if shown"),
        rating: z.string().optional().describe("Star rating if shown"),
      }),
    ).min(1)
    .describe("Products recommended by retail assistant"),
  addedToCart: z.object({
    success: z.boolean().describe("Whether a product was added to cart"),
    productName: z.string().trim().min(1).describe("Name of product added to cart"),
    price: z.string().optional().describe("Price of the product"),
  }),
});

async function main() {
  console.log("\n🛒 Retailer retail assistant Demo\n");

  const browser = await browserbase.launch({
    apiKey: process.env.BROWSERBASE_API_KEY!,
    ...{
      proxies: true as any,
      browserSettings: {
        verified: true,
        blockAds: true,
        viewport: { width: 1280, height: 720 },
        solveCaptchas: true,
      },
    },
  });
  let stagehand: Awaited<ReturnType<typeof Stagehand.create>> | undefined;
  let failure: unknown;
  let failed = false;
  let report: { output: z.infer<typeof ResultSchema>; duration: number; sessionUrl: string; usage: unknown } | undefined;
  try {
    stagehand = await Stagehand.create(StagehandCreateOptionsSchema.parse({ browser }));

    const sessionId = stagehand.browser.sessionId!;
    const sessionUrl = `https://www.browserbase.com/sessions/${sessionId}`;
    console.log(`📺 Session: ${sessionUrl}\n`);

    const page = (await stagehand.browser.context.pages())[0];
    await page.goto("https://www.retailer.com", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(8000);

    const agent = (task: Parameters<typeof runBrowserTask>[1]) =>
      runBrowserTask(stagehand!, task, {
        systemPrompt:
          "You are a shopping assistant on the Retailer website. Be efficient — complete the task as quickly as possible with minimal unnecessary steps.",
      });

    const startTime = Date.now();

    const result = await agent({
      instruction: `
  1. Click the retail assistant chat button in the bottom-right corner to open the chat.
  2. Type "Show me a highly-rated shovel for under $50" in the input and click send.
  3. Wait 12 seconds for retail assistant to respond. Note the visible product recommendations.
  4. retail assistant shows product cards with "Add to Cart" buttons right in the chat. Click "Add to Cart" on the first product shown.
  5. Done — report what retail assistant recommended and which product was added to cart.

  Do NOT scroll through the entire carousel. Do NOT use the main search bar. Everything happens inside the retail assistant chat.
  `.trim(),
      maxSteps: 25,
      output: ResultSchema,
    });

    const duration = Math.round((Date.now() - startTime) / 1000);

    if (result.success !== true || result.completed !== true) {
      throw new Error("Browser task did not complete successfully");
    }
    const output = ResultSchema.parse(result.output);
    if (output.addedToCart.success !== true) throw new Error("Product was not confirmed added to cart");
    report = { output, duration, sessionUrl, usage: result.usage };
  } catch (error) {
    failed = true;
    failure = error;
    throw error;
  } finally {
    const releases = await Promise.allSettled([
      Promise.resolve().then(() => stagehand?.close()),
      Promise.resolve().then(() => browser.close()),
    ]);
    const errors = releases.flatMap(result => result.status === "rejected" ? [result.reason] : []);
    if (errors.length) throw new AggregateError(failed ? [failure, ...errors] : errors, "Browser cleanup failed");
  }
  if (!report) throw new Error("Browser task result is unavailable");
  console.log(`\n✅ Done in ${report.duration}s`);
  console.log(`📺 Replay: ${report.sessionUrl}\n`);
  console.log("🧠 retail assistant said:");
  for (const rec of report.output.recommendations) {
    console.log(`   • ${rec.name} ${rec.price ? `(${rec.price})` : ""}`);
  }
  console.log(`\n🛒 Added to cart: Yes — ${report.output.addedToCart.productName} ${report.output.addedToCart.price ?? ""}`);
  console.log(`\n📊 Token usage: ${JSON.stringify(report.usage)}`);

}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
