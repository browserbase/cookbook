// Process 1 — Category Deep Dive.
//
// Walks the category tree, extracts §3.1 listing fields from category pages, and
// emits the discovered PDP URLs as Process-2 input — tying the two processes
// together.
//
//   npm run deep-dive -- --competitor aliexpress --country BR --cats 2
//   npm run deep-dive -- --competitor shein --country BR --cats 2
//   npm run deep-dive -- --competitor shopee --country BR --level 2 --cats 3   (needs bootstrap)
//   npm run deep-dive -- --competitor temu --country BR --cats 2               (needs bootstrap)
//
// Shopee and Temu gate category browsing behind login → reuse a logged-in Context
// (run `npm run bootstrap-shopee` / `bootstrap-temu` first). AliExpress/Shein browse
// logged-out.
import { promises as fs } from "node:fs";
import path from "node:path";

import { requireEnv, type Competitor, type Country } from "./config";
import { createSession, type ManagedSession } from "./session";
import { attachCountryContext } from "./context/attach";
import {
  extractTree,
  extractListings,
  paginate,
  specFor,
  type Listing,
} from "./categories/extract";
import { OUT_DIR } from "./fetchPdp";

const AUTH_COMPETITORS: Competitor[] = ["shopee", "temu"]; // gate category browsing behind login

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

async function main(): Promise<void> {
  requireEnv();
  const args = parseArgs(process.argv.slice(2));
  const competitor = (args.competitor as Competitor) ?? "aliexpress";
  const country = (args.country as Country) ?? "BR";
  const level = Number(args.level ?? 2);
  const maxCats = Number(args.cats ?? 2);
  const depth = Number(args.depth ?? 1); // 2 = descend L1→L2 subcategories
  const pages = Number(args.pages ?? 1); // paginate ≤N pages per category
  const needsAuth = AUTH_COMPETITORS.includes(competitor);

  console.log(
    `\n🌳 Deep Dive — ${competitor}/${country}  (${needsAuth ? "authenticated Context" : "logged-out"})`,
  );
  const t0 = Date.now();

  // Shopee reuses a logged-in Context (+ matching proxy geo); others browse logged-out.
  const s: ManagedSession = needsAuth
    ? await attachCountryContext(competitor, country, { persist: false })
    : await createSession(country);
  console.log(`📺 live view: ${s.liveViewUrl}`);

  const all: (Listing & { category: string; catid: string })[] = [];
  let blockedCats = 0;
  let crawled = 0;
  let rawPages = 0;
  // Raw listing-page HTML per crawled page — SAMPLE_ORG's P1 deliverable is raw data
  // (their parsers, their schema); the parsed §3.1 listings are the value-add.
  const rawDir = path.join(OUT_DIR, "payloads");
  await fs.mkdir(rawDir, { recursive: true });
  const slug = (s: string) =>
    s
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "cat";
  try {
    // 1) Category tree
    const tree = await extractTree(s.pwPage, competitor, country);
    const byLevel = (n: number) => tree.filter((c) => c.level === n).length;
    console.log(
      `category tree: ${tree.length} nodes (L1=${byLevel(1)}, L2=${byLevel(2)}, L3=${byLevel(3)})`,
    );

    let targets = tree.filter((c) => c.level === level);
    if (!targets.length) targets = tree;
    let candidates = targets.map((c) => ({
      name: c.name,
      catid: c.catid,
      url: c.url,
    }));

    // Fallback (e.g. AliExpress, whose homepage exposes few category links).
    if (!candidates.length) {
      candidates = specFor(competitor, country).fallbackCategories.map(
        (url, i) => ({ name: `search-${i + 1}`, catid: "", url }),
      );
      if (candidates.length)
        console.log(
          `(no tree categories; using ${candidates.length} fallback listing URLs)`,
        );
    }
    if (!candidates.length) {
      console.error(
        `no categories found for ${competitor} — check the deep-dive spec in categories/extract.ts`,
      );
      await s.close();
      process.exit(1);
    }

    // 1b) Optional L2/L3 descent — harvest subcategories from the first few L1 cats.
    if (depth >= 2) {
      const sub: typeof candidates = [];
      for (const c of candidates.slice(0, Math.min(3, candidates.length))) {
        try {
          const kids = (
            await extractTree(s.pwPage, competitor, country, c.url)
          ).filter((k) => k.url !== c.url);
          sub.push(
            ...kids.map((k) => ({
              name: `${c.name} › ${k.name}`,
              catid: k.catid,
              url: k.url,
            })),
          );
        } catch {
          /* subcategory harvest best-effort */
        }
      }
      if (sub.length) {
        console.log(`descended L1→L${depth}: +${sub.length} subcategories`);
        candidates = [...sub, ...candidates];
      }
    }

    // 2) Crawl until `maxCats` NON-EMPTY categories (skipping personalized feeds /
    // empties), paginating ≤`pages` pages each ("all pages within a category").
    const maxAttempts = Math.min(
      candidates.length,
      Math.max(maxCats * 6, maxCats + 4),
    );
    console.log(
      `crawling up to ${maxCats} non-empty categories × ≤${pages} page(s) (from ${candidates.length} candidates)…`,
    );
    let attempts = 0;
    for (const cat of candidates) {
      if (crawled >= maxCats || attempts >= maxAttempts) break;
      attempts++;
      const seenInCat: Record<string, boolean> = {};
      let catCount = 0;
      let sample: Listing | undefined;
      let blockedAtPage1 = false;
      for (let pg = 1; pg <= pages; pg++) {
        const { blocked, finalUrl, listings, pageHtml } = await extractListings(
          s.pwPage,
          paginate(cat.url, pg),
          competitor,
          country,
        );
        if (blocked) {
          if (pg === 1) {
            blockedAtPage1 = true;
            blockedCats++;
            console.log(`  ⛔ ${cat.name || cat.url} → blocked: ${finalUrl}`);
          }
          break;
        }
        const fresh = listings.filter((l) => {
          const k = l.productUrl.split("?")[0];
          if (seenInCat[k]) return false;
          seenInCat[k] = true;
          return true;
        });
        if (!fresh.length) break; // no further pages
        if (pageHtml) {
          const rawFile = path.join(
            rawDir,
            `p1-${competitor}-${country}-${slug(cat.catid || cat.name)}-p${pg}.raw.html`,
          );
          await fs.writeFile(rawFile, pageHtml);
          rawPages++;
        }
        if (!sample) sample = fresh[0];
        catCount += fresh.length;
        all.push(
          ...fresh.map((l) => ({ ...l, category: cat.name, catid: cat.catid })),
        );
      }
      if (blockedAtPage1) continue;
      if (catCount === 0) {
        console.log(`  · ${cat.name || cat.url} → 0 (skip)`);
        continue;
      }
      crawled++;
      console.log(
        `  ✓ ${cat.name || cat.url} → ${catCount} listings${pages > 1 ? ` (≤${pages}p)` : ""}`,
      );
      if (sample)
        console.log(
          `      • ${sample.title ?? "(no title)"} | ${sample.price ?? "—"} | sold ${sample.unitsSold ?? "—"}`,
        );
    }
  } finally {
    await s.close();
  }

  if (crawled === 0) {
    console.error(
      `\n⛔ No categories crawled successfully.` +
        (needsAuth
          ? `\n   The Context may not be authenticated — re-run: npm run bootstrap -- ${competitor} ${country}`
          : ""),
    );
    process.exit(1);
  }

  // 3) Emit outputs: full listings dump + a Process-2 PDP-URL list
  await fs.mkdir(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const listingsFile = path.join(
    OUT_DIR,
    `deepdive-${competitor}-${country}-${stamp}.json`,
  );
  const urlsFile = path.join(OUT_DIR, `pdp-urls-${competitor}-${country}.json`);

  const elapsedSec = (Date.now() - t0) / 1000;
  // Dedupe PDP URLs (strip query) so Process 2 doesn't re-fetch the same item.
  const seen: Record<string, boolean> = {};
  const pdpUrls: { competitor: Competitor; country: Country; url: string }[] =
    [];
  for (const l of all) {
    const key = l.productUrl.split("?")[0];
    if (seen[key]) continue;
    seen[key] = true;
    pdpUrls.push({ competitor, country, url: key });
  }

  await fs.writeFile(
    listingsFile,
    JSON.stringify(
      {
        competitor,
        country,
        categories: crawled,
        count: all.length,
        elapsedSec,
        listings: all,
      },
      null,
      2,
    ),
  );
  await fs.writeFile(urlsFile, JSON.stringify(pdpUrls, null, 2));

  console.log(
    `\n📊 Deep Dive: ${all.length} listings from ${crawled} categories in ${elapsedSec.toFixed(1)}s (${blockedCats} blocked)`,
  );
  console.log(
    `   §3.1 captured: productUrl, imageUrl, title, price, unitsSold (+ rawCardText for offers/badges)`,
  );
  console.log(
    `   raw deliverable: ${rawPages} listing-page HTML file(s) → output/payloads/p1-${competitor}-${country}-*.raw.html`,
  );
  console.log(`\n✓ listings → ${listingsFile}`);
  console.log(
    `✓ ${pdpUrls.length} unique PDP URLs → ${urlsFile}  (Process-2 input)`,
  );
  console.log(
    `\nNext (Process 2):  npm run one -- "${pdpUrls[0]?.url ?? "<url>"}"`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(`\n${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
