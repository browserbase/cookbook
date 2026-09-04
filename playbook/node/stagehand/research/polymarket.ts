import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod/v4";

const marketSchema = z.object({
  marketTitle: z.string().trim().min(1),
  marketStatus: z.enum(["open", "closed", "resolved", "unknown"]),
  currentOdds: z.string().trim().min(1).nullable(),
  yesPrice: z.string().trim().min(1).nullable(),
  noPrice: z.string().trim().min(1).nullable(),
  totalVolume: z.string().trim().min(1).nullable(),
  priceChange: z.string().trim().min(1).nullable(),
});

async function runWorkflow() {
  let browser: Awaited<ReturnType<typeof browserbase.launch>> | null = null;
  let stagehand: Stagehand | null = null;
  let observation: (z.infer<typeof marketSchema> & {
    sourceURL: string;
    observedAt: string;
  }) | undefined;
  let failed = false;

  try {
    const query = process.env.POLYMARKET_QUERY?.trim();
    const marketTitle = process.env.POLYMARKET_MARKET_TITLE?.trim();
    const marketURL = process.env.POLYMARKET_MARKET_URL?.trim();
    if (!query || !marketTitle || !marketURL) {
      throw new Error("Set POLYMARKET_QUERY, POLYMARKET_MARKET_TITLE, and POLYMARKET_MARKET_URL.");
    }
    const destination = new URL(marketURL);
    if (
      destination.protocol !== "https:" ||
      !["polymarket.com", "www.polymarket.com"].includes(destination.hostname) ||
      destination.username || destination.password || destination.port ||
      destination.search || destination.hash ||
      !/^\/event\/[^/]+\/?$/.test(destination.pathname)
    ) {
      throw new Error("Configure the exact HTTPS Polymarket event URL.");
    }
    browser = await browserbase.launch({
      apiKey: process.env.BROWSERBASE_API_KEY!,
    });
    stagehand = await Stagehand.create({
      browser,
      model: {
        modelName: "google/gemini-2.5-flash",
        apiKey: process.env.GOOGLE_API_KEY,
      },
    });
    const page = (await browser.context.pages())[0];
    if (!page) throw new Error("Polymarket page unavailable.");
    const response = await page.goto("https://polymarket.com/", { timeout: 30_000 });
    if (!response || !response.ok()) {
      throw new Error("Polymarket homepage unavailable.");
    }

    const focus = await stagehand.act(
      "Click the market search input at the top of the page.",
      { page },
    );
    if (focus.data.success !== true) throw new Error("Search focus failed.");
    const search = await stagehand.act(
      "Fill the market search input with %query% and display matching search results.",
      { page, variables: { query } },
    );
    if (search.data.success !== true) throw new Error("Market search failed.");
    const select = await stagehand.act(
      "Open the search result whose full market title exactly matches %marketTitle% and whose destination URL exactly matches %marketURL%. If no exact match is present, stop without selecting another result. Do not trade or place an order.",
      { page, variables: { marketTitle, marketURL: destination.href } },
    );
    if (select.data.success !== true) throw new Error("Market selection failed.");

    const sourceURL = await page.url();
    if (sourceURL !== destination.href) {
      throw new Error("Selected page does not match the configured Polymarket event URL.");
    }
    const extracted = await stagehand.extract(
      "Read the selected market's full title, displayed status, odds or prices, total volume, and price change from this page. Use null for any absent quote or numeric display, never infer missing data. Use unknown when status is not explicit. Do not describe closed or resolved market quotes as current trading prices.",
      marketSchema,
      { page },
    );
    const parsed = marketSchema.safeParse(extracted.data);
    if (!parsed.success) throw new Error("Market extraction is incomplete.");
    if (await page.url() !== destination.href) {
      throw new Error("The page changed during market extraction.");
    }
    const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
    if (normalize(parsed.data.marketTitle) !== normalize(marketTitle)) {
      throw new Error("Extracted market title does not match the requested market.");
    }
    if ([parsed.data.currentOdds, parsed.data.yesPrice, parsed.data.noPrice].every(
      (value) => value === null,
    )) {
      throw new Error("The selected market has no observed odds or prices.");
    }
    observation = { ...parsed.data, sourceURL, observedAt: new Date().toISOString() };
  } catch {
    failed = true;
    console.error("Polymarket workflow failed; check configuration, actions, and market data.");
  } finally {
    if (stagehand) {
      try {
        await stagehand.close();
      } catch {
        failed = true;
        console.error("Polymarket Stagehand cleanup failed.");
      }
    }
    if (browser) {
      try {
        await browser.close();
      } catch {
        failed = true;
        console.error("Polymarket browser cleanup failed.");
      }
    }
  }
  if (failed || !observation) {
    return { success: false, error: "Polymarket workflow failed" };
  }
  console.log("Observed market display and closed session. Quotes are model-extracted and may be stale.");
  return { success: true, data: observation };
}

runWorkflow().then((result) => {
  console.log("Execution result:", result);
  process.exit(result.success ? 0 : 1);
});

export default runWorkflow;
