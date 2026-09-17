/**
 * the cookbook example demo — fetch a county property-tax bill with Stagehand (controlled).
 *
 * Drives the Allen County (IN) portal with AI-resolved actions instead of brittle
 * CSS selectors: type the address, click Search, open the matching property,
 * open "View Tax Bill", extract the PDF link, and download it.
 *
 * Run:  node --import tsx cookbook_example-demo/stagehand/fetch-bill.ts ["123 Some St"]
 */
import path from "node:path";
import {
  makeStagehand,
  replayUrl,
  download,
  findBillHref,
  DESKTOP,
  MODEL,
} from "./lib.js";

const ADDRESS = process.argv[2] || "1010 Boulder Ridge Trl";
const PORTAL = "https://lowtaxinfo.com/allencounty";
const OUT = path.join(DESKTOP, "tax-bill.pdf");

async function main() {
  const stagehand = await makeStagehand();

  const page = (await stagehand.browser.context.activePage())!;
  console.log(`\n🤖 Stagehand (${MODEL})`);
  console.log(`🎥 Watch it live: ${replayUrl(stagehand)}\n`);

  try {
    console.log("🌐 Opening the Allen County portal…");
    await page.goto(PORTAL, { waitUntil: "domcontentloaded" });

    console.log(`⌨️  Typing the address: "${ADDRESS}"`);
    await stagehand.act("Type %addr% into the property Address search field", {
      page: page,
      variables: { addr: ADDRESS },
    });

    console.log("🔎 Clicking Search…");
    await stagehand.act("Click the Search button", { page: page });
    await page.waitForLoadState("networkidle").catch(() => {});

    console.log("🏠 Opening the top matching property…");
    await stagehand.act(
      "Click the 'Property Details' link for the first/best-matching property in the results",
      { page: page },
    );
    await page.waitForLoadState("networkidle").catch(() => {});

    console.log("🧾 Opening the tax bill document…");
    await stagehand.act("Click the 'View Tax Bill' link", { page: page });

    // Read the PDF link deterministically from the DOM (precise, not an LLM guess).
    const pdfUrl = await findBillHref(stagehand);
    if (!pdfUrl) throw new Error("Could not find the View Tax Bill link");
    console.log(`    ↳ ${pdfUrl}`);

    console.log("⬇️  Downloading the tax-bill PDF to your Desktop…");
    const bytes = await download(pdfUrl, OUT);
    console.log(`\n✅ Saved ${OUT}  (${(bytes / 1e6).toFixed(1)} MB)`);
    console.log(`🎥 Replay: ${replayUrl(stagehand)}`);
  } finally {
    await stagehand.close();
    await stagehand.browser.close();
  }
}

main().catch((e) => {
  console.error("\n❌", e.message);
  process.exit(1);
});
