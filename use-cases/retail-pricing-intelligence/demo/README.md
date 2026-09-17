# Marketplace B Pricing Intelligence — Live Demo

Interactive demo for this example. Type an item → parallel Browserbase
Verified sessions open Marketplace B retailer storefronts through residential
proxies → structured prices stream back into one comparable feed, each row
linking to its recorded session.

## Run

```bash
cd demo
node server.js      # → http://localhost:4321
```

Requires env: `BROWSERBASE_API_KEY` (already set in this shell).
No LLM key needed — extraction is deterministic DOM parsing, not model calls.

## Using it live

1. Type an item (`milk`, `bananas`, `eggs`, `tide pods`).
2. Pick retailers (Merchant C / Merchant F / Retailer-on-Marketplace B / Merchant E) and a market.
3. **Run extraction.** Each retailer gets its own card with a **live browser
   iframe** — the room watches 3 real browsers hit Marketplace B at once.
4. Results roll up below: cheapest-per-retailer headline stats (winner
   highlighted green), then a per-retailer table with price, unit price,
   promos, stock, sponsored/rating badges — every table titled with a
   **session-replay link**.
5. Optional **"Build guest basket"** checkbox → assembles a 3-item cart per
   retailer and pulls subtotal + $10 checkout minimum + delivery-fee threshold.

## Demo tips

- **Warm it up before the call**: run `milk` once so DNS/proxy/session paths are hot. First run of the day is the slowest (~20–30s); later runs ~15s.
- **Best single click**: `milk`, market = Houston, all 3 retailers, basket ON. Shows shelf price + unit price + promo + fees + subtotal in one shot.
- **Zip story**: run the same item in two markets (Houston vs New York) to show prices move — that's the pricing-team money shot.
- Live iframes need outbound access to browserbase.com; if a venue blocks it, the extraction still works — you just lose the live video (results + replay links are unaffected).

## Orchestration choice (for the "how'd you build it" question)

Stagehand SDK on Browserbase, **one session per retailer, run concurrently**,
orchestrated by this ~230-line Node/Express server streaming progress over SSE.

- Not **browse CLI** — single-session daemon, can't fan out.
- Not **`stagehand.agent` / autonomous agents** — the path is known and fixed
  (`/store/<retailer>/s?k=<query>` → wait for hydration → parse `#store-wrapper`),
  so an agent loop only adds latency and nondeterminism in front of the user.
- Stagehand SDK gives deterministic navigation + the live-view URL for the
  iframes, and each concurrent session *is* the "Concurrent sessions" story.

The anti-bot handling (auth-modal removal, JS-click for cart, IP-derived zip)
comes from the browse.sh `marketplace-b.example.invalid/browse-add-items-guest` skill.

## Files

- `server.js` — session orchestration, SSE, deterministic price/basket parser
- `public/index.html` — the UI
- `../showcase.html` → `~/Downloads/Browserbase-Marketplace B-Data-Showcase.pdf` — the "everything we pull" leave-behind
- `../demo-extraction.json` — sample captured feed
