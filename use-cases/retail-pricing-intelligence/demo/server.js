import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import Browserbase from "@browserbasehq/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4321;

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

app.use(express.static(path.join(__dirname, "public")));

// ---------- session replay proxy (HLS) ----------
// Replay metadata: which pages exist + their durations. Frontend plays the
// longest page (the storefront) once the session has finished processing.
app.get("/api/replay/:sessionId", async (req, res) => {
  try {
    const meta = await bb.sessions.replays.retrieve(req.params.sessionId);
    const pages = (meta.pages || []).map((p) => ({
      pageId: p.pageId,
      durationMs: (p.endTimeMs || 0) - (p.startTimeMs || 0),
    }));
    res.json({ pages });
  } catch (err) {
    res.status(404).json({ error: String(err.message || err) });
  }
});

// HLS playlist proxy — no API key reaches the browser; segment URLs inside the
// playlist are pre-signed and load directly from Browserbase's CDN.
app.get("/replays/:sessionId/:pageId", async (req, res) => {
  try {
    const playlist = await bb.sessions.replays.retrievePage(
      req.params.sessionId,
      req.params.pageId,
    );
    res.type("application/vnd.apple.mpegurl").send(await playlist.text());
  } catch (err) {
    res.status(404).send(String(err.message || err));
  }
});

const RETAILERS = {
  merchant_c: "Merchant C",
  merchant_f: "Merchant F",
  retailer: "Retailer",
  "merchant-e": "Merchant E",
  walgreens: "Walgreens",
  cvs: "CVS",
};

const MARKETS = {
  auto: null,
  houston: { city: "Houston", state: "TX", country: "US" },
  seattle: { city: "Seattle", state: "WA", country: "US" },
  newyork: { city: "New York", state: "NY", country: "US" },
  chicago: { city: "Chicago", state: "IL", country: "US" },
};

// ---------- price parsing (deterministic, no LLM) ----------

const OZ_PER = { gal: 128, lb: 16, oz: 1, "fl oz": 1, qt: 32, pt: 16, l: 33.8 };

function parseSizeToOz(name) {
  // "2 x 48 oz", "64 fl oz", "1 gal", "0.5 gal", "52 fl oz", "2.7 lbs"
  const multi = name.match(
    /(\d+)\s*x\s*([\d.]+)\s*(fl oz|oz|gal|lbs?|qt|pt|l)\b/i,
  );
  if (multi) {
    const unit = multi[3].toLowerCase().replace(/s$/, "");
    return parseInt(multi[1], 10) * parseFloat(multi[2]) * (OZ_PER[unit] || 1);
  }
  const single = name.match(/([\d.]+)\s*(fl oz|oz|gal|lbs?|qt|pt|l)\b/i);
  if (single) {
    const unit = single[2].toLowerCase().replace(/s$/, "");
    return parseFloat(single[1]) * (OZ_PER[unit] || 1);
  }
  return null;
}

function parseItems(text) {
  const start = text.indexOf("Results for");
  if (start >= 0) text = text.slice(start);
  // stop at sponsored carousels / related sections to keep organic results
  const chunks = text.split("Current price: ").slice(1);
  const items = [];
  for (const chunk of chunks) {
    const m = chunk.match(/^\$([\d,]+\.\d{2})\s*\$[\d.]+\s*/);
    if (!m) continue;
    const price = parseFloat(m[1].replace(",", ""));
    let rest = chunk.slice(m[0].length);

    let originalPrice = null;
    let promo = null;
    const orig = rest.match(
      /Original Price: \$([\d,]+\.\d{2})\s*\$[\d,.]+\s*((?:\$[\d.]+ off(?:; limit \d+)?)?)\s*([\d]+% off)/,
    );
    if (orig) {
      originalPrice = parseFloat(orig[1].replace(",", ""));
      promo = orig[2] ? `${orig[2].trim()} (${orig[3]})` : orig[3];
      rest = rest.replace(orig[0], "");
    }

    const sponsored = /Sp onsored|Sponsored/.test(rest);
    const inStock = /Many in stock/.test(rest);
    const rating = (rest.match(/\((\d+(?:\.\d+)?K?)\)/) || [])[1] || null;

    // name = text up to first terminator token
    let name = rest.split(/Many in stock|★|Sp onsored|Sponsored|\bAdd\b/)[0];
    name = name
      .replace(/\d+ ct$/, "")
      .replace(/• \d+ sizes/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!name || name.length < 3) continue;

    const oz = parseSizeToOz(name);
    const unitPrice = oz ? +(price / oz).toFixed(3) : null;

    items.push({
      name,
      price,
      original_price: originalPrice,
      promo,
      unit_price_per_oz: unitPrice,
      availability: inStock ? "Many in stock" : null,
      rating_count: rating,
      sponsored,
    });
    if (items.length >= 12) break;
  }
  return items;
}

// ---------- page helpers (from browse.sh marketplace_b skill) ----------

// The "$0 delivery fee" auth modal has no close affordance (Escape/backdrop
// don't work; its Close buttons are 0x0). Removing it via DOM mutation is the
// only way to get a clean live view. Must re-run after every navigation.
const REMOVE_AUTH_MODAL = `(() => {
  let removed = 0;
  document.querySelectorAll("[role=dialog]").forEach(d => {
    const t = d.textContent || "";
    if (t.includes("delivery fee on your first 3 orders") ||
        (t.includes("Or continue with") && t.includes("Continue"))) { d.remove(); removed++; }
  });
  document.body.classList.remove("body--auth-modal-open");
  document.getElementById("js-app")?.removeAttribute("aria-hidden");
  document.querySelectorAll('[aria-hidden="true"]').forEach(el => {
    if (el.querySelectorAll("button, a, input").length > 3) el.removeAttribute("aria-hidden");
  });
  return removed;
})()`;

async function buildGuestBasket(page, count) {
  // JS-click Add buttons (synthetic events bypass the modal overlay), then
  // read the cart drawer: line items, subtotal, checkout minimum, fee progress.
  const added = await page.evaluate((n) => {
    const btns = Array.from(
      document.querySelectorAll('button[aria-label^="Add 1 ct"]'),
    ).slice(0, n);
    btns.forEach((b) => b.click());
    return btns.map((b) =>
      b.getAttribute("aria-label").replace(/^Add 1 ct /, ""),
    );
  }, count);
  if (!added.length) return null;
  await new Promise((r) => setTimeout(r, 3500));
  await page.evaluate(REMOVE_AUTH_MODAL).catch(() => {});
  await page.evaluate(() => {
    const cart = Array.from(document.querySelectorAll("button")).filter((b) =>
      /delivery fee|View Cart/i.test(b.textContent || ""),
    )[0];
    cart?.click();
  });
  await new Promise((r) => setTimeout(r, 2000));
  return page.evaluate((addedItems) => {
    const drawer = Array.from(
      document.querySelectorAll("[role=dialog]"),
    ).filter((d) => /Personal .* Cart/i.test(d.textContent || ""))[0];
    if (!drawer) return { added: addedItems, error: "cart drawer not open" };
    const t = drawer.textContent || "";
    return {
      added: addedItems,
      subtotal: (t.match(/Item subtotal[^$]*\$([\d.]+)/) || [])[1] || null,
      checkout_minimum:
        (t.match(/\$([\d.]+) Min\. to checkout/) || [])[1] || null,
      fee_progress:
        (t.match(/Add \$[\d.]+ to get \$0 delivery fee/) || [])[0] || null,
    };
  }, added);
}

// ---------- per-retailer extraction task ----------

async function extractRetailer({ retailer, query, market, basket, send }) {
  const label = RETAILERS[retailer] || retailer;
  const t0 = Date.now();
  let stagehand;
  try {
    send({
      retailer,
      event: "status",
      step: "session",
      msg: "Creating Verified session (residential proxy)…",
    });

    const geo = MARKETS[market];
    stagehand = await Stagehand.create(
      StagehandCreateOptionsSchema.parse({
        browser: await browserbase.launch({
          apiKey: process.env.BROWSERBASE_API_KEY,
          ...{
            proxies: geo ? [{ type: "browserbase", geolocation: geo }] : true,
            browserSettings: { verified: true },
          },
        }),
      }),
    );

    send({
      retailer,
      event: "session",
      sessionId: stagehand.browser.sessionId,
      liveUrl: (await bb.sessions.debug(stagehand.browser.sessionId))
        .debuggerFullscreenUrl,
      replayUrl: `https://www.browserbase.com/sessions/${stagehand.browser.sessionId}`,
    });

    const page = (await stagehand.browser.context.pages())[0];
    send({
      retailer,
      event: "status",
      step: "navigate",
      msg: `Opening ${label} storefront on Marketplace B…`,
    });
    await page.goto(
      `https://marketplace-b.example.invalid/store/${retailer}/s?k=${encodeURIComponent(query)}`,
      {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      },
    );

    send({
      retailer,
      event: "status",
      step: "extract",
      msg: "Waiting for prices to hydrate…",
    });
    // wait for product tiles to render
    for (let i = 0; i < 15; i++) {
      const ready = await page
        .evaluate(() =>
          (document.querySelector("#store-wrapper")?.innerText || "").includes(
            "Current price",
          ),
        )
        .catch(() => false);
      if (ready) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    await page.evaluate(REMOVE_AUTH_MODAL).catch(() => {});
    await new Promise((r) => setTimeout(r, 500));

    const { text, zip } = await page.evaluate(() => ({
      text:
        document.querySelector("#store-wrapper")?.innerText ||
        document.body.innerText,
      zip:
        (document.querySelector("header")?.innerText.match(/\b(\d{5})\b/) ||
          [])[1] || null,
    }));

    const items = parseItems(text.replace(/\s*\n\s*/g, " "));
    if (!items.length) throw new Error("No priced items found on page");

    let basketResult = null;
    if (basket) {
      send({
        retailer,
        event: "status",
        step: "basket",
        msg: "Building guest basket (top 3 items)…",
      });
      basketResult = await buildGuestBasket(page, 3).catch((e) => ({
        error: String(e.message || e),
      }));
    }

    send({
      retailer,
      event: "done",
      label,
      zip,
      items,
      basket: basketResult,
      elapsed_s: +((Date.now() - t0) / 1000).toFixed(1),
      replayUrl: `https://www.browserbase.com/sessions/${stagehand.browser.sessionId}`,
    });
  } catch (err) {
    send({ retailer, event: "error", msg: String(err.message || err) });
  } finally {
    if (stagehand) await stagehand.close().catch(() => {});
  }
}

// ---------- SSE endpoint ----------

app.get("/api/run", async (req, res) => {
  const query = String(req.query.query || "milk").slice(0, 60);
  const retailers = String(req.query.retailers || "merchant_c,merchant_f,retailer")
    .split(",")
    .filter((r) => RETAILERS[r]);
  const market =
    MARKETS[req.query.market] !== undefined ? String(req.query.market) : "auto";
  const basket = req.query.basket === "1";

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  send({ event: "start", query, retailers, market, basket });
  await Promise.all(
    retailers.map((retailer) =>
      extractRetailer({ retailer, query, market, basket, send }),
    ),
  );
  send({ event: "complete" });
  res.end();
});

app.listen(PORT, () => {
  console.log(`Marketplace B pricing demo → http://localhost:${PORT}`);
});
