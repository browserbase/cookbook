// Diagnostic (account-free): where does a logged-out Temu PDP keep the real product
// detail (price/specs/variants)? The standard adapter takes the first non-empty inline
// global (rawData = page shell). This probe instead enumerates EVERY candidate global
// with size+top-keys, scans all window props for the goods id / price signals, AND
// watches XHR/fetch responses for a goods-detail API — so we pin the true source.
//
//   npx tsx src/probeTemu.ts "<temu pdp url>" [country=BR]
import { createSession } from "./session";
import type { Country } from "./config";

const GLOBALS = [
  "__CHUNK_DATA__",
  "rawData",
  "__rawData__",
  "__NEXT_DATA__",
  "__INITIAL_DATA__",
  "__INIT_DATA__",
  "__APOLLO_STATE__",
  "_oak_data",
];

async function main(): Promise<void> {
  const url = process.argv[2];
  const country = (process.argv[3] as Country) ?? "BR";
  if (!url) {
    console.error("usage: npx tsx src/probeTemu.ts <url> [country=BR]");
    process.exit(1);
  }
  const idMatch = url.match(/-g-(\d+)\.html/);
  const goodsId = idMatch ? idMatch[1] : "";

  const s = await createSession(country);
  console.log(`📺 live view: ${s.liveViewUrl}\n`);

  // The RAW Playwright page DOES expose page.on('response') (Stagehand's does not) —
  // collect JSON-ish API responses that look product-relevant.
  const xhr: Array<{
    url: string;
    status: number;
    bytes: number;
    hit: boolean;
  }> = [];
  s.pwPage.on("response", async (resp) => {
    try {
      const u = resp.url();
      if (!/api|goods|detail|query|graphql|bff|product|mget/i.test(u)) return;
      const body = await resp.text();
      const hit =
        (goodsId && body.includes(goodsId)) ||
        /"salePrice"|"skuList"|"priceInfo"|"price"\s*:/.test(body);
      xhr.push({
        url: u.slice(0, 150),
        status: resp.status(),
        bytes: body.length,
        hit,
      });
    } catch {
      /* body not re-readable */
    }
  });

  await s.pwPage
    .goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 })
    .catch(() => {});
  // Give CSR hydration + lazy XHRs time to fire.
  await s.pwPage.waitForTimeout(20_000);

  // Enumerate globals + any window prop carrying the goods id / price. __name-safe:
  // anonymous pageFunction, plain for-loops only, `any` casts for window indexing.
  const report = await s.pwPage.evaluate(
    (args: { names: string[]; goodsId: string }) => {
      const globals: any[] = [];
      for (let i = 0; i < args.names.length; i++) {
        const n = args.names[i];
        const v = (window as any)[n];
        if (v == null) {
          globals.push({ name: n, present: false });
          continue;
        }
        let size = 0;
        let keys: string[] = [];
        try {
          const j = JSON.stringify(v);
          size = j ? j.length : 0;
        } catch {
          /* circular */
        }
        try {
          if (typeof v === "object") keys = Object.keys(v).slice(0, 25);
        } catch {
          /* */
        }
        globals.push({ name: n, present: true, type: typeof v, size, keys });
      }
      // Brute scan: which window props hold the goods id or price structures?
      const carriers: any[] = [];
      const wkeys = Object.keys(window);
      for (let i = 0; i < wkeys.length; i++) {
        const k = wkeys[i];
        try {
          const v = (window as any)[k];
          if (v && typeof v === "object") {
            const str = JSON.stringify(v);
            if (
              str &&
              str.length > 300 &&
              ((args.goodsId && str.indexOf(args.goodsId) !== -1) ||
                /"salePrice"|"skuList"|"priceInfo"/.test(str))
            ) {
              carriers.push({
                key: k,
                size: str.length,
                hasPrice: /"salePrice"|"priceInfo"|"price":/.test(str),
              });
            }
          }
        } catch {
          /* */
        }
      }
      return {
        globals,
        carriers: carriers.slice(0, 25),
        title: document.title,
      };
    },
    { names: GLOBALS, goodsId },
  );

  // Most important first: title, globals, carriers.
  console.log("=== page title ===");
  console.log(" ", report.title, "\n");
  console.log("=== candidate inline globals (present? size? top keys?) ===");
  for (const g of report.globals) console.log(" ", JSON.stringify(g));
  console.log("\n=== window props carrying goods id / price structures ===");
  if (report.carriers.length)
    for (const c of report.carriers) console.log(" ", JSON.stringify(c));
  else console.log("  (none — product detail not in any inline global)");

  // XHR: surface only the signal (errors/blocks/hits); homepage + telemetry noise → file.
  const signal = xhr.filter((x) => x.hit || x.status !== 200);
  console.log(
    `\n=== XHR: ${xhr.length} product-relevant responses; ${signal.length} are hits or non-200 ===`,
  );
  for (const x of signal) console.log(" ", JSON.stringify(x));
  const captcha = xhr.find((x) =>
    /obtain_captcha|verify|challenge/i.test(x.url),
  );
  if (captcha)
    console.log(
      `  ⚠ CAPTCHA/verify endpoint hit: ${captcha.url} (${captcha.bytes} bytes)`,
    );

  // Durable full report (no truncation).
  const fs = await import("node:fs");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = `output/temu-probe-${country}-${stamp}.json`;
  fs.writeFileSync(
    outPath,
    JSON.stringify({ url, country, ...report, xhr }, null, 2),
  );
  console.log(`\n✓ full report → ${outPath}`);

  await s.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(`\n${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
