/**
 * Sample Organization demo — fetch a county property-tax bill with a Stagehand AGENT.
 *
 * Instead of scripting each step, hand the goal to Stagehand's autonomous agent
 * and let it navigate the portal on its own. Then extract the PDF link and
 * download it. This is the "point it at any portal" version.
 *
 * Run:  node --import tsx sample_org-demo/stagehand/fetch-bill-agent.ts ["123 Some St"]
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
import { runBrowserTask } from "./../browser-task.js";

const ADDRESS = process.argv[2] || "1010 Boulder Ridge Trl";
const PORTAL = "https://lowtaxinfo.com/allencounty";
const OUT = path.join(DESKTOP, "tax-bill.pdf");

async function main() {
  const stagehand = await makeStagehand();

  const page = (await stagehand.browser.context.activePage())!;
  console.log(`\n🤖 Stagehand AGENT (${MODEL})`);
  console.log(`🎥 Watch it live: ${replayUrl(stagehand)}\n`);

  try {
    await page.goto(PORTAL, { waitUntil: "domcontentloaded" });

    console.log(`🧠 Handing the goal to the agent for "${ADDRESS}"…`);
    const agent = (task: Parameters<typeof runBrowserTask>[1]) =>
      runBrowserTask(stagehand!, task, {});
    await agent({
      instruction:
        `On this Allen County property-tax portal, search for the property at the address "${ADDRESS}". ` +
        `Open the best-matching property's details, then open its "View Tax Bill" document.`,
      maxSteps: 15,
    });

    console.log("🧾 Reading the tax-bill PDF link…");
    const pdfUrl = await findBillHref(stagehand);
    if (!pdfUrl)
      throw new Error("Agent did not reach a page with a View Tax Bill link");
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
