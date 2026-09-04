// price-compare.workflow.mjs — example Browse-as-Code workflow.
// Compare captured item-plus-shipping quotes and require fresh verification before a scoped recommendation.
//
//   ANTHROPIC_API_KEY=... node price-compare.workflow.mjs            # uses defaults below
//   QUERY="..." ZIP="10001" node price-compare.workflow.mjs --fresh  # parameterize
//
// Patterns: fan-out-and-synthesize · comparative-ranking · ships-to-ZIP steer
//           · adversarial-verification · retry-on-block.
// Each leaf is ONE Anthropic Managed Agent session (see ../harness.mjs).

import {
  agent,
  compute,
  forEach,
  retry,
  verify,
  phase,
  log,
} from "../harness.mjs";

const QUERY =
  process.env.QUERY || "Supreme box-logo beanie / New Era 59FIFTY hat";
const ZIP = process.env.ZIP || "94122";
const MERCHANTS = (process.env.MERCHANTS || "eBay,Grailed,StockX")
  .split(",")
  .map((s) => s.trim()).filter(Boolean);
if (!/^\d{5}(?:-\d{4})?$/.test(ZIP) || !QUERY.trim() || !MERCHANTS.length) throw new Error("Provide a product query, US ZIP code, and at least one merchant.");

const LISTINGS = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          price_usd: { type: "number" },
          url: { type: "string" },
          currency: { type: "string" },
          in_stock: { type: "boolean" },
          ships_to_zip: { type: "string", enum: ["yes", "no", "unknown"] },
          shipping_cost_usd: { type: ["number", "null"] },
        },
        required: ["name", "price_usd", "url", "currency", "in_stock", "ships_to_zip", "shipping_cost_usd"],
      },
    },
    blocked: { type: "boolean" },
  },
  required: ["items", "blocked"],
};

// ── FAN-OUT: one managed-agent leaf per merchant (independent sessions) ──
phase(`Gather "${QUERY}" across ${MERCHANTS.length} merchants`);
const perMerchant = await forEach(MERCHANTS, (m) =>
  retry(
    () =>
      agent(
        `On ${m}, find up to 5 in-stock listings for: ${QUERY}. For each, report exact name, ` +
          `the item price before shipping, tax and separately charged fees, currency, in_stock, listing URL, whether it ships to ZIP ${ZIP} ` +
          `(yes/no/unknown), and shipping_cost_usd to ${ZIP} or null when unknown. Only report USD amounts when the currency is USD; do not convert currencies. Prefer web search/fetch; ` +
          `if blocked and you cannot recover, return items:[] and blocked:true. Never invent data.`,
        { resultSchema: LISTINGS, label: m },
      ),
    2,
  )
    .catch(() => ({ items: [], blocked: true }))
    .then((r) => ({ ...r, merchant: m })),
);

const cents = value => typeof value === "number" && Number.isFinite(value) && value >= 0
  && Number.isSafeInteger(Math.round(value * 100)) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6
  ? Math.round(value * 100) : null;
const validUrl = value => {
  try { const url = new URL(value); return typeof value === "string" && /^https?:\/\//i.test(value) && !/[\s\\]/.test(value) && ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
};
phase(`Compare item plus shipping to ${ZIP}`);
const normalized = compute("validate quotes", () => perMerchant.filter(r => r?.blocked === false && Array.isArray(r.items)).flatMap(r =>
  r.items.map(item => {
    const i = item && typeof item === "object" ? item : {};
    const itemCents = cents(i.price_usd), shippingCents = cents(i.shipping_cost_usd);
    const unavailable = i.in_stock === false || i.ships_to_zip === "no";
    const eligible = !unavailable && i.in_stock === true && i.ships_to_zip === "yes"
      && i.currency === "USD" && typeof i.name === "string" && Boolean(i.name.trim()) && validUrl(i.url)
      && itemCents !== null && shippingCents !== null && Number.isSafeInteger(itemCents + shippingCents);
    return { merchant: r.merchant, name: i.name ?? null, url: i.url ?? null,
      currency: i.currency ?? null, item_usd: i.currency !== "USD" || itemCents === null ? null : itemCents / 100,
      ship_usd: i.currency !== "USD" || shippingCents === null ? null : shippingCents / 100,
      delivered_usd: eligible ? (itemCents + shippingCents) / 100 : null,
      status: eligible ? "eligible" : unavailable ? "unavailable" : "unknown" };
  })));
const ranked = normalized.filter(i => i.status === "eligible").sort((a, b) => a.delivered_usd - b.delivered_usd);
const uncertain = normalized.filter(i => i.status === "unknown");
const unavailable = normalized.filter(i => i.status === "unavailable");
const incompleteMerchants = perMerchant.filter(r => !r || r.blocked !== false || !Array.isArray(r.items)).map(r => r?.merchant || "unknown merchant");
const cheapest = ranked[0];
let checks = [];
if (cheapest) {
  phase("Verify candidate with a fresh quote");
  checks = await verify([{
    id: "delivered-quote-matches",
    run: async () => {
      const v = await agent(
        `Open ${cheapest.url} in a fresh session. Verify the SAME listing is in stock and ships to ZIP ${ZIP}. ` +
        `Return destination_zip as the exact requested ZIP, its exact URL, currency, price_usd before shipping/tax/separate fees, shipping_usd (null if unknown), in_stock, and ships_to_zip (yes/no/unknown). Never invent missing shipping or convert currency.`,
        { cache: false, label: "verify-winner", resultSchema: {
          type: "object", properties: {
            destination_zip: { type: "string" }, url: { type: "string" }, currency: { type: "string" }, in_stock: { type: "boolean" },
            ships_to_zip: { type: "string", enum: ["yes", "no", "unknown"] },
            price_usd: { type: "number" }, shipping_usd: { type: ["number", "null"] },
          }, required: ["destination_zip", "url", "currency", "in_stock", "ships_to_zip", "price_usd", "shipping_usd"],
        } },
      );
      return Boolean(v && v.destination_zip === ZIP && v.url === cheapest.url && v.currency === "USD" && v.in_stock === true && v.ships_to_zip === "yes"
        && cents(v.price_usd) !== null && cents(v.shipping_usd) !== null
        && cents(v.price_usd) === cents(cheapest.item_usd) && cents(v.shipping_usd) === cents(cheapest.ship_usd));
    },
  }]);
}
const verified = checks.length === 1 && checks.every(check => check?.pass === true);
const complete = incompleteMerchants.length === 0 && uncertain.length === 0;
if (cheapest && verified && complete) {
  log(`\nVerified lowest item-plus-shipping quote among captured listings to ${ZIP}:\n` + JSON.stringify(cheapest, null, 2));
} else {
  log("\nProvisional comparison only. No verified winner: " + (!cheapest ? "no fully priced, available USD quote" : !verified ? "fresh verification failed or was unavailable" : "some merchants or shipping quotes remain unknown"));
}
log("Prices exclude tax and separately charged fees. Only the candidate was freshly rechecked; other captured quotes may be cached or change.");
log("Verification results:\n" + JSON.stringify(checks, null, 2));
if (incompleteMerchants.length) log("Incomplete merchants: " + incompleteMerchants.join(", "));
log("Known item-plus-shipping quotes:\n" + JSON.stringify(ranked, null, 2));
if (uncertain.length) log("Unpriced or uncertain listings (not ranked):\n" + JSON.stringify(uncertain, null, 2));
if (unavailable.length) log("Unavailable listings (excluded):\n" + JSON.stringify(unavailable, null, 2));
