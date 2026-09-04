import type { Page } from "playwright-core";
import type { Competitor, Country } from "../config";

export interface Category {
  catid: string;
  name: string;
  url: string;
  level: number; // dotted-id depth (Shopee); 1 where categories aren't hierarchical
}

// §3.1 — information required at the category/listings level.
export interface Listing {
  productUrl: string;
  productId: string;
  imageUrl: string | null;
  title: string | null;
  price: string | null; // sale price
  originalPrice: string | null; // pre-discount / struck-through price
  discount: string | null; // e.g. "-67%"
  unitsSold: string | null; // "X vendidos"
  offers: string[]; // free shipping, save R$X, new-user, coupon
  promotions: string[]; // best seller, flash/super deal, almost sold out
  badges: string[]; // Choice, #hashtag tags
  rawCardText: string; // full visible card text (authoritative source for the above)
}

/**
 * Parse the §3.1 fields out of a listing card's visible text. Bilingual (PT for BR,
 * ES for MX/CL/CO/AR). Heuristic — `rawCardText` is kept as the authoritative source.
 * Note: strips "save" phrases ("Economize R$X" / "Poupe" / "Ahorra") BEFORE picking
 * the price, since Shein cards lead with the savings amount, not the price.
 */
export function parseCard(
  text: string,
): Omit<Listing, "productUrl" | "productId" | "imageUrl" | "rawCardText"> {
  // Currency tokens across BR + Spanish LatAm. Codes can sit on EITHER side of the $:
  // R$40,67 · MX$113.9 · $MXN105.00 (Shein MX) · $941 (CL/CO/AR). So: up-to-3 caps, $,
  // up-to-3 caps, number.
  const PRICE = /[A-Z]{0,3}\$[A-Z]{0,3}\s?[\d.,]+/g;
  const SAVE =
    /(?:poupe|economize|ahorra)\s*[A-Z]{0,3}\$?[A-Z]{0,3}\s?[\d.,]+/gi;
  const noSave = text.replace(SAVE, " ");
  const prices = noSave.match(PRICE) || [];
  const price = prices[0] ?? null;
  const originalPrice =
    prices.length > 1 && prices[1] !== price ? prices[1] : null;

  const soldM = text.match(/([\d.,]+\s*(?:mil|rb)?\+?)\s+vendidos?/i);
  const unitsSold = soldM ? soldM[1].trim() : null;

  const discM = text.match(/-\s?(\d{1,3})\s?%/);
  const discount = discM ? `-${discM[1]}%` : null;

  const offers: string[] = [];
  if (/frete gr[aá]tis|env[ií]o gratis|free shipping/i.test(text))
    offers.push("free shipping");
  const save = text.match(
    /(?:poupe|economize|ahorra)\s*[A-Z]{0,3}\$?[A-Z]{0,3}\s?[\d.,]+/i,
  );
  if (save) offers.push(save[0].replace(/\s+/g, " ").trim());
  const nu = text.match(/novo usu[aá]rio[^,.]*off|nuevo usuario[^,.]*off/i);
  if (nu) offers.push(nu[0].replace(/\s+/g, " ").trim());
  if (/\bcupom\b|\bcup[oó]n\b|\bcoupon\b/i.test(text)) offers.push("coupon");

  const promotions: string[] = [];
  const best = text.match(
    /#?\s?\d{0,3}\s?mais vendido[^#]{0,40}|m[aá]s vendido[^#]{0,40}|top vendas[^.,]{0,30}/i,
  );
  if (best) promotions.push(best[0].replace(/\s+/g, " ").trim());
  if (/quase esgotado|casi agotado|almost sold/i.test(text))
    promotions.push("almost sold out");
  if (/\bflash\b|super (?:deals|ofertas)|rel[aâ]mpago/i.test(text))
    promotions.push("flash/super deal");

  const badges: string[] = [];
  if (/\bchoice\b/i.test(text)) badges.push("Choice");
  for (const tag of text.match(/#[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9]{2,28}/g) || []) {
    if (!/mais ?vendido/i.test(tag) && !badges.includes(tag)) badges.push(tag);
  }

  const title =
    noSave
      .replace(/^[\s\d]+/, "")
      .replace(/#[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9]*/g, " ")
      .replace(/-\s?\d{1,3}\s?%/g, " ")
      .replace(/[A-Z]{0,3}\$[A-Z]{0,3}\s?[\d.,]+/g, " ")
      .replace(/[\d.,]+\s*(?:mil|rb)?\+?\s+vendidos?/gi, " ")
      .replace(/\((?:\d[\d.,]*)\+?\)/g, " ")
      .replace(/\b\d{0,3}\s*mais vendido[^,.]*/gi, " ")
      .replace(/quase esgotado!?/gi, " ")
      .replace(/top vendas[^,.]*/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140) || null;

  return {
    title,
    price,
    originalPrice,
    discount,
    unitsSold,
    offers: [...new Set(offers)],
    promotions: [...new Set(promotions)],
    badges: [...new Set(badges)].slice(0, 6),
  };
}

export interface ListingResult {
  blocked: boolean;
  finalUrl: string;
  listings: Listing[];
  /** Rendered listing-page HTML — the RAW Process-1 deliverable (SAMPLE_ORG applies
   *  their own parsers; the parsed Listing[] above is the value-add, not the
   *  contract). Empty when the page was blocked/unreadable. */
  pageHtml: string;
}

interface Patterns {
  categoryRe: string; // matches category hrefs (string → in-page RegExp)
  productRe: string; // matches product hrefs
  idRe: string; // capturing groups → product id
}

// Link patterns are country-independent; only the host/locale varies per country.
const PATTERNS: Partial<Record<Competitor, Patterns>> = {
  shopee: {
    categoryRe: "cat\\.[0-9.]+",
    productRe: "i\\.[0-9]+\\.[0-9]+",
    idRe: "i\\.([0-9]+)\\.([0-9]+)",
  },
  shein: {
    categoryRe: "-s?c-[0-9]+",
    productRe: "-p-[0-9]+",
    idRe: "-p-([0-9]+)",
  },
  aliexpress: {
    categoryRe: "/category/[0-9]+",
    productRe: "/item/[0-9]+",
    idRe: "/item/([0-9]+)",
  },
  // Temu product = `-g-<id>.html` (confirmed from SAMPLE_ORG's example URL). Its homepage
  // category links are inconsistent, so the crawl leans on search-as-category
  // (fallbackCategories below), like AliExpress. The category regex is best-effort
  // and gets refined once we can probe a live authenticated Temu session.
  temu: {
    categoryRe: "/channel/[A-Za-z0-9-]+\\.html",
    productRe: "-g-[0-9]+\\.html",
    idRe: "-g-([0-9]+)\\.html",
  },
};

// Temu uses one host with a path-based locale. Per SAMPLE_ORG's example the BR path is
// `br-es`; Temu may also expose `br-pt` (Portuguese) — confirm on the live session.
const TEMU_LOCALE: Record<Country, string> = {
  BR: "br-es",
  MX: "mx-es",
  CL: "cl-es",
  CO: "co-es",
  AR: "ar-es",
};

// Per-(competitor, country) storefront host. Probed live: AliExpress pt=BR / es=Spanish
// LatAm; Shein BR=br.shein.com, MX=www.shein.com.mx. CL/CO/AR Shein hosts are
// best-guess — validate before relying. Shopee operates only in BR in LatAm.
// Probed live: BR/MX/CO are browsable storefronts. CL serves only a geo-landing (no
// category tree); AR has no Shein storefront (shein.com.ar is parked, ar.shein.com is
// Arabic) — import-restricted market → effectively N/A.
const SHEIN_HOST: Record<Country, string> = {
  BR: "br.shein.com",
  MX: "www.shein.com.mx",
  CO: "www.shein.com.co",
  CL: "www.shein.cl", // landing only — no standard category browse
  AR: "www.shein.ar", // landing only — Shein not operating in AR
};

function originFor(c: Competitor, country: Country): string {
  if (c === "aliexpress")
    return country === "BR"
      ? "https://pt.aliexpress.com"
      : "https://es.aliexpress.com";
  if (c === "shein") return `https://${SHEIN_HOST[country]}`;
  if (c === "shopee") return "https://shopee.com.br";
  if (c === "temu") return `https://www.temu.com/${TEMU_LOCALE[country]}`;
  throw new Error(`no deep-dive host for competitor: ${c}`);
}

export interface Spec extends Patterns {
  origin: string;
  treeUrl: string;
  fallbackCategories: string[];
}

export function specFor(c: Competitor, country: Country): Spec {
  const p = PATTERNS[c];
  if (!p)
    throw new Error(
      `no deep-dive spec for competitor: ${c} (needs auth or not implemented)`,
    );
  const origin = originFor(c, country);
  const fallbackCategories =
    c === "aliexpress"
      ? [
          `${origin}/w/wholesale-tenis.html`,
          `${origin}/w/wholesale-mochila.html`,
        ]
      : c === "temu"
        ? [
            `${origin}/search_result.html?search_key=tenis`,
            `${origin}/search_result.html?search_key=mochila`,
          ]
        : [];
  return { ...p, origin, treeUrl: `${origin}/`, fallbackCategories };
}

/** Append a pagination param to a category/search URL (1-indexed; page 1 = unchanged). */
export function paginate(url: string, page: number): string {
  if (page <= 1) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("page", String(page));
    return u.toString();
  } catch {
    return url + (url.includes("?") ? "&" : "?") + `page=${page}`;
  }
}

/**
 * Extract category links from a page. Defaults to the homepage (the L1 tree); pass
 * `fromUrl` (a category page) to harvest that category's SUBcategories — i.e. L2/L3
 * descent.
 */
export async function extractTree(
  page: Page,
  c: Competitor,
  country: Country,
  fromUrl?: string,
): Promise<Category[]> {
  const spec = specFor(c, country);
  await page.goto(fromUrl ?? spec.treeUrl, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(5000);

  const raw = await page.evaluate((re: string) => {
    const rx = new RegExp(re);
    const seen: Record<string, boolean> = {};
    const out: { href: string; name: string }[] = [];
    const anchors = document.querySelectorAll("a[href]");
    for (let i = 0; i < anchors.length; i++) {
      const h = anchors[i].getAttribute("href") || "";
      if (rx.test(h) && !seen[h]) {
        seen[h] = true;
        out.push({
          href: h,
          name: (anchors[i].textContent || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 60),
        });
      }
    }
    return out;
  }, spec.categoryRe);

  const cats: Category[] = [];
  const seenCat: Record<string, boolean> = {};
  for (const r of raw) {
    const m = r.href.match(/cat\.([0-9.]+)|-s?c-([0-9]+)|\/category\/([0-9]+)/);
    const catid = m ? m[1] || m[2] || m[3] : r.href;
    if (seenCat[catid]) continue;
    seenCat[catid] = true;
    cats.push({
      catid,
      name: r.name,
      url: r.href.startsWith("http") ? r.href : spec.origin + r.href,
      level: catid.includes(".") ? catid.split(".").length : 1,
    });
  }
  return cats;
}

/** Extract §3.1 listing fields from a category/search page. */
export async function extractListings(
  page: Page,
  url: string,
  c: Competitor,
  country: Country,
): Promise<ListingResult> {
  const spec = specFor(c, country);
  const isBlocked = (u: string) =>
    /verify\/traffic|\/buyer\/login|\/login|login\.html/.test(u);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  } catch {
    /* nav error — read whatever rendered */
  }
  await page.waitForTimeout(3500); // let post-load redirects settle
  if (isBlocked(page.url()))
    return { blocked: true, finalUrl: page.url(), listings: [], pageHtml: "" };

  // Scroll to trigger lazy listings. Guarded: some sites soft-navigate mid-scroll
  // ("execution context destroyed"), which must not sink the whole crawl.
  for (let k = 0; k < 8; k++) {
    try {
      await page.evaluate(() => window.scrollBy(0, 1200));
    } catch {
      /* navigated mid-scroll */
    }
    await page.waitForTimeout(500);
  }

  const finalUrl = await page.url();
  if (isBlocked(finalUrl))
    return { blocked: true, finalUrl, listings: [], pageHtml: "" };

  // Harvest, retrying once if the context was destroyed by a late navigation.
  let raw: { href: string; image: string | null; text: string }[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      raw = await page.evaluate((re: string) => {
        const rx = new RegExp(re);
        const seen: Record<string, boolean> = {};
        const out: { href: string; image: string | null; text: string }[] = [];
        const anchors = document.querySelectorAll("a[href]");
        for (let i = 0; i < anchors.length; i++) {
          const a = anchors[i] as HTMLAnchorElement;
          const h = a.getAttribute("href") || "";
          if (!rx.test(h) || seen[h]) continue;
          seen[h] = true;
          // Use the anchor's own text if rich enough (AliExpress wraps the whole
          // card); otherwise climb to the enclosing product card (Shein wraps only
          // the image in the <a>, with title/price as sibling nodes).
          let el = a as HTMLElement;
          let text = (el.innerText || "").replace(/\s+/g, " ").trim();
          let up = 0;
          while (text.length < 40 && el.parentElement && up < 4) {
            el = el.parentElement;
            text = (el.innerText || "").replace(/\s+/g, " ").trim();
            up++;
          }
          const img = a.querySelector("img") || el.querySelector("img");
          out.push({
            href: h,
            image: img ? img.getAttribute("src") : null,
            text: text.slice(0, 600),
          });
        }
        return out;
      }, spec.productRe);
      break;
    } catch {
      await page.waitForTimeout(1500);
    }
  }

  // Raw listing-page HTML (post-scroll, lazy content loaded) for the P1 deliverable.
  let pageHtml = "";
  try {
    pageHtml = await page.content();
  } catch {
    /* navigated away mid-read — raw artifact is best-effort */
  }

  const idRe = new RegExp(spec.idRe);
  const listings: Listing[] = raw.map((r) => {
    const idM = r.href.match(idRe);
    const productUrl = r.href.startsWith("http")
      ? r.href
      : r.href.startsWith("//")
        ? "https:" + r.href
        : spec.origin + r.href;
    return {
      productUrl,
      productId: idM ? idM.slice(1).filter(Boolean).join("_") : "",
      imageUrl: r.image,
      ...parseCard(r.text || ""),
      rawCardText: r.text || "",
    };
  });

  return { blocked: false, finalUrl, listings, pageHtml };
}
