// Visual gallery — renders captured content + LIVE images into output/gallery.html.
//
//   npm run gallery        # build output/gallery.html, then open it in a browser
//
// We capture image URLs, not image bytes (see ACCEPTANCE.md §3.1), so "viewing the
// images" means rendering those URLs as <img> tags that load live from each site's
// CDN. This reads what's already on disk — no Browserbase sessions:
//   • Process 1 listings  ← output/deepdive-<competitor>-<country>-*.json (parsed §3.1)
//   • Process 2 PDPs      ← output/manifest.jsonl + output/payloads/*  (raw deliverable)
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, "..", "output");
const PAYLOADS = path.join(OUT_DIR, "payloads");

const MAX_P1_PER_CELL = 18; // keep the page light
const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );

/** Normalize a captured image ref to a loadable URL. Protocol-relative → https;
 *  bare Shopee CDN hash (e.g. `br-11134207-7r98o-…`) → susercontent file URL. */
function imgUrl(ref: string | null | undefined): string | null {
  if (!ref) return null;
  if (ref.startsWith("//")) return "https:" + ref;
  if (ref.startsWith("http")) return ref;
  if (/^[a-z]{2}-\d|^[a-f0-9-]{16,}$/i.test(ref))
    return `https://down-br.img.susercontent.com/file/${ref}`;
  return ref;
}

const chips = (arr: string[] | undefined, cls: string) =>
  (arr ?? [])
    .slice(0, 4)
    .map((x) => `<span class="chip ${cls}">${esc(x)}</span>`)
    .join("");

// ── Process 1: parsed listing cards ──────────────────────────────────────────
interface Listing {
  productUrl: string;
  imageUrl: string | null;
  title: string | null;
  price: string | null;
  originalPrice: string | null;
  discount: string | null;
  unitsSold: string | null;
  offers?: string[];
  promotions?: string[];
  badges?: string[];
}

function p1Card(l: Listing): string {
  const u = imgUrl(l.imageUrl);
  const media = u
    ? `<a href="${esc(l.productUrl)}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(u)}" onerror="this.closest('.card').classList.add('noimg')"></a>`
    : `<div class="ph">no image URL captured</div>`;
  return `<div class="card">
    ${media}
    <div class="body">
      <div class="title"><a href="${esc(l.productUrl)}" target="_blank" rel="noopener">${esc(l.title) || "(no title)"}</a></div>
      <div class="price">${esc(l.price) || "—"}${l.originalPrice ? ` <s>${esc(l.originalPrice)}</s>` : ""}${l.discount ? ` <b>${esc(l.discount)}</b>` : ""}</div>
      <div class="meta">${l.unitsSold ? esc(l.unitsSold) + " sold" : ""}</div>
      <div class="chips">${chips(l.offers, "o")}${chips(l.promotions, "p")}${chips(l.badges, "b")}</div>
    </div>
  </div>`;
}

async function buildP1(): Promise<string> {
  const files = (await fs.readdir(OUT_DIR)).filter((f) =>
    /^deepdive-.+\.json$/.test(f),
  );
  // Latest file per (competitor,country): names sort with an ISO stamp at the tail.
  const latest = new Map<string, string>();
  for (const f of files.sort()) {
    const m = f.match(/^deepdive-([a-z]+)-([A-Z]{2})-/);
    if (m) latest.set(`${m[1]}-${m[2]}`, f);
  }
  const sections: string[] = [];
  let total = 0;
  for (const [cell, file] of [...latest].sort()) {
    let d: any;
    try {
      d = JSON.parse(await fs.readFile(path.join(OUT_DIR, file), "utf8"));
    } catch {
      continue;
    }
    const ls: Listing[] = (d.listings ?? []).filter(
      (l: Listing) => l.title || l.imageUrl,
    );
    if (!ls.length) continue;
    const withImg = ls.filter((l) => l.imageUrl).length;
    total += ls.length;
    sections.push(`<h3>${esc(cell)} <span class="sub">${ls.length} listings · ${withImg} with image (${Math.round((withImg / ls.length) * 100)}%) · ${esc(d.categories)} categories</span></h3>
      <div class="grid">${ls.slice(0, MAX_P1_PER_CELL).map(p1Card).join("")}</div>
      ${ls.length > MAX_P1_PER_CELL ? `<div class="more">+ ${ls.length - MAX_P1_PER_CELL} more in ${esc(file)}</div>` : ""}`);
  }
  return `<section><h2>Process 1 — Category Deep Dive <span class="sub">${total} parsed listings · §3.1 fields</span></h2>${sections.join("") || '<p class="empty">No deepdive-*.json yet — run <code>npm run deep-dive</code>.</p>'}</section>`;
}

// ── Process 2: PDP captures (raw deliverable) ────────────────────────────────
/** Best-effort first-image + title per capture source, for the thumbnail only —
 *  the authoritative artifact is the linked raw .html / payload .json. */
async function p2Preview(
  row: any,
): Promise<{ img: string | null; title: string | null }> {
  try {
    if (row.payloadPath) {
      const raw = await fs.readFile(
        path.join(OUT_DIR, row.payloadPath),
        "utf8",
      );
      if (row.competitor === "shopee") {
        const d = JSON.parse(raw);
        return {
          img: imgUrl((d.item?.images ?? [])[0]),
          title: d.item?.title ?? null,
        };
      }
      const im = raw.match(
        /(?:\/\/|https?:\/\/)[^"'\\ ]*?(?:ltwebstatic|alicdn|aliexpress-media)[^"'\\ ]*?\.(?:jpg|jpeg|png|webp|avif)/i,
      );
      const ti = raw.match(
        /"(?:goods_name|productName|subject|title)"\s*:\s*"([^"]{4,90})"/i,
      );
      return { img: imgUrl(im?.[0]), title: ti?.[1] ?? null };
    }
    if (row.rawHtmlPath) {
      const html = await fs.readFile(
        path.join(OUT_DIR, row.rawHtmlPath),
        "utf8",
      );
      const og =
        html.match(/og:image"[^>]*content="([^"]+)"/i) ||
        html.match(/content="([^"]+)"[^>]*property="og:image"/i);
      const ti =
        html.match(/<h1[^>]*data-pl="product-title"[^>]*>([^<]{4,90})/i) ||
        html.match(/og:title"[^>]*content="([^"]{4,90})"/i);
      return { img: imgUrl(og?.[1]), title: ti?.[1] ?? null };
    }
  } catch {
    /* preview is best-effort */
  }
  return { img: null, title: null };
}

async function buildP2(): Promise<string> {
  let lines: string[] = [];
  try {
    lines = (await fs.readFile(path.join(OUT_DIR, "manifest.jsonl"), "utf8"))
      .split("\n")
      .filter(Boolean);
  } catch {
    return `<section><h2>Process 2 — Daily URL Monitoring</h2><p class="empty">No manifest.jsonl yet — run <code>npm start</code> or <code>npm run one</code>.</p></section>`;
  }
  // Dedupe by url, keep the latest ok row.
  const byUrl = new Map<string, any>();
  for (const ln of lines) {
    let r: any;
    try {
      r = JSON.parse(ln);
    } catch {
      continue;
    }
    if (r.outcome === "ok") byUrl.set(r.url, r);
  }
  const rows = [...byUrl.values()];
  const cards = await Promise.all(
    rows.map(async (r) => {
      const { img, title } = await p2Preview(r);
      const media = img
        ? `<img loading="lazy" src="${esc(img)}" onerror="this.closest('.card').classList.add('noimg')">`
        : `<div class="ph">image refs are inside the payload →</div>`;
      const links = [
        r.rawHtmlPath
          ? `<a href="payloads/${esc(path.basename(r.rawHtmlPath))}" target="_blank">raw html</a>`
          : "",
        r.payloadPath
          ? `<a href="payloads/${esc(path.basename(r.payloadPath))}" target="_blank">payload json</a>`
          : "",
        `<a href="${esc(r.url)}" target="_blank" rel="noopener">live page</a>`,
      ]
        .filter(Boolean)
        .join(" · ");
      return `<div class="card">${media}<div class="body">
      <div class="title">${esc(title) || esc(r.url.split("/").pop())}</div>
      <div class="src"><span class="badge">${esc(r.competitor)}/${esc(r.country)}</span> <code>${esc(r.source)}</code></div>
      <div class="links">${links}</div></div></div>`;
    }),
  );
  return `<section><h2>Process 2 — Daily URL Monitoring <span class="sub">${rows.length} PDP captures · raw HTML + envelope on disk</span></h2>
    <div class="grid">${cards.join("") || '<p class="empty">No ok captures in the manifest yet.</p>'}</div></section>`;
}

async function main(): Promise<void> {
  const [p1, p2] = await Promise.all([buildP1(), buildP2()]);
  const html = `<!doctype html><meta charset="utf-8"><title>SAMPLE_ORG capture gallery</title>
<style>
  :root{--bg:#0d0d0f;--card:#1a1a1f;--line:#2a2a31;--fg:#e8e8ea;--mut:#8a8a93;--accent:#FF4500}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 -apple-system,Segoe UI,Roboto,sans-serif}
  header{padding:20px 24px;border-bottom:1px solid var(--line)} header h1{margin:0;font-size:19px}
  header .note{color:var(--mut);margin-top:6px;max-width:760px}
  header .note b{color:var(--accent)}
  section{padding:18px 24px} h2{font-size:16px;border-left:3px solid var(--accent);padding-left:10px}
  h3{font-size:13px;color:var(--fg);margin:22px 0 8px;text-transform:uppercase;letter-spacing:.04em}
  .sub{color:var(--mut);font-weight:400;text-transform:none;letter-spacing:0}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden;display:flex;flex-direction:column}
  .card img{width:100%;height:190px;object-fit:cover;background:#222;display:block}
  .card.noimg img{display:none} .card.noimg::before{content:"image URL 404 / expired";display:block;height:190px;line-height:190px;text-align:center;color:var(--mut);background:#161619;font-size:12px}
  .ph{height:190px;display:flex;align-items:center;justify-content:center;text-align:center;color:var(--mut);background:#161619;padding:0 14px;font-size:12px}
  .body{padding:9px 11px;display:flex;flex-direction:column;gap:5px}
  .title{font-size:12.5px;line-height:1.35;max-height:3.4em;overflow:hidden} .title a{color:var(--fg);text-decoration:none}
  .price{font-weight:700;color:#fff} .price s{color:var(--mut);font-weight:400} .price b{color:var(--accent)}
  .meta{color:var(--mut);font-size:11.5px}
  .chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:2px}
  .chip{font-size:10px;padding:1px 6px;border-radius:9px;border:1px solid var(--line)}
  .chip.o{color:#7fd1ff} .chip.p{color:#ffd27f} .chip.b{color:#c79bff}
  .src{font-size:11px;color:var(--mut)} .src code{color:#9fe0a0} .badge{background:var(--accent);color:#fff;border-radius:4px;padding:1px 5px;font-size:10px}
  .links{font-size:11px} .links a{color:#7fd1ff;text-decoration:none;margin-right:2px}
  .more,.empty{color:var(--mut);font-size:12px;margin:8px 0} code{background:#222;padding:1px 5px;border-radius:4px}
</style>
<header>
  <h1>SAMPLE_ORG competitor capture — gallery</h1>
  <div class="note">Images load <b>live from each site's CDN</b> — we capture image <b>URLs</b>, not files (per the requirements doc §3.1). A blank/"404" tile means that CDN URL has since expired or is geo-restricted from your IP, not that capture failed; the URL is still in the data on disk. Generated by <code>npm run gallery</code> from <code>output/</code>.</div>
</header>
${p1}
${p2}`;
  const out = path.join(OUT_DIR, "gallery.html");
  await fs.writeFile(out, html);
  console.log(`✓ gallery → ${out}\n  open it:  open "${out}"`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
