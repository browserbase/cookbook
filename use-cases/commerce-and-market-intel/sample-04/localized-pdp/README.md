# Sample Organization — Localized PDP scraping at scale

**Browserbase + Playwright + Contexts** demo for Sample Organization: extract fully-rendered, locally-priced product page HTML across hundreds of products × tens of store regions, without re-running the store-locator UI for every fetch.

## What it does

1. **Bypasses bot detection** on HomeDepot.com (Akamai) and TractorSupply.com (Akamai + SBSD + Forter) using `verified: true` + Browserbase residential proxies
2. **Runs the store-locator ceremony once per store** (ZIP or store_id) and persists cookies in a **Browserbase Context**
3. **Spawns lightweight read-only sessions** attached to each Context for every subsequent product fetch — skipping the ceremony entirely
4. **Auto-retries on intermittent Akamai 403s** (fresh session = fresh IP, same Context = preserved localization)
5. **Captures the entire rendered DOM** via incremental scroll + `networkidle` wait, then `page.content()`

## Why this exists

Sample Organization's input is a CSV of ~600 `(product_id, store_localization)` rows. Naive approach: run the full store-locator UI ceremony before every product fetch — 60–90 s per row, fragile selectors, ~8–12 hours sequential.

This demo amortizes the ceremony across a Context: run it once per unique localization, reuse for hundreds of product fetches. **~25–80 min for the full 588-row CSV at 4 workers**, depending on scroll thoroughness.

## Architecture

```
┌─────────────────────────────────────────┐
│   bootstrap_context.py (one-time/key)    │
│   ─ creates BB Context                   │
│   ─ session with persist: true           │
│   ─ runs store-locator ceremony          │
│   ─ verifies localization cookies        │
│   ─ saves context_id → contexts_map.json │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│   fetch_product.py (fast path, ×N)       │
│   ─ session with persist: false          │
│     attached to bootstrapped Context     │
│   ─ goto(product_url)                    │
│   ─ incremental scroll + networkidle     │
│   ─ retry on Akamai 403                  │
└─────────────────────────────────────────┘
                   │
                   ▼
            output/*.html
```

## Measured performance

| Metric                        | Original approach        | This demo                  |
|-------------------------------|--------------------------|----------------------------|
| HD product fetch              | 60–90 s (ceremony every) | ~20 s (Context-attached)   |
| HD with full-DOM scroll       | —                        | ~33 s (every lazy section) |
| TSC product fetch             | 60–90 s                  | ~17 s                      |
| Bootstrap (one-time / store)  | —                        | ~45 s (HD), ~70 s (TSC)    |
| 588-row CSV @ 4 workers       | ~8–12 hrs                | ~25–80 min                 |

## Three TSC ceremony bugs we found

While reproducing Sample Organization's original Python scripts we identified three silent bugs in their store-locator flow — these likely explain the "flaky at scale" issue they reported:

1. **Wrong cookies in their verification.** TSC writes `lpStoreNum` + `lpZipCode` + `lpZipCodeNum`. The reference scripts checked `myStoreNumber` / `storeZip` — fields TSC doesn't set. Successful ceremonies were being torn down because the check looked at the wrong fields.

2. **Sign-in modal intercepts clicks (intermittent A/B bucket).** The close button's `aria-label="Close sign in popup"` lives on an inner `<svg>` element — `svg.click()` doesn't exist as a method. Walk up via `.closest('button')` to dismiss.

3. **`page.fill()` doesn't fire React's `onChange`.** TSC's search captured the IP-geo auto-filled ZIP (e.g. `77063` Houston from a Houston-area proxy) instead of the typed `77566`. The DOM *visibly* showed the right ZIP but React state had the wrong one. Fix: `page.keyboard.type(zip, delay=50)` + press Enter. This silently-wrong failure mode is exactly what flakes at scale.

## Files

| File | Purpose |
|------|---------|
| `bootstrap_context.py` | One-time per (domain, ZIP/store_id). Runs the ceremony, verifies cookies, writes to `contexts_map.json`. |
| `fetch_product.py`     | Fast-path product fetch. Attaches read-only to a Context, scrolls through the full page, returns HTML. |
| `run_csv.py`           | Orchestrator. Reads the CSV, bootstraps missing Contexts, fans out product fetches in parallel. |
| `proxy_geo.py`         | ZIP / store_id → proxy geolocation lookup. Maps known IDs to reliable metros. |
| `contexts_map.json`    | `{ "homedepot:zip:90210": "<context_id>", ... }` — populated as you bootstrap. |
| `diag_tsc_steps.py`    | Step-by-step diagnostic with screenshots — useful when a new TSC A/B bucket breaks. |
| `diag_tsc.py`          | Quick TSC homepage selector probe. |

## Quick start

```bash
export BROWSERBASE_API_KEY=...
export BROWSERBASE_PROJECT_ID=...
pip install browserbase playwright

# 1) One-time bootstrap (per unique ZIP or store_id)
python bootstrap_context.py homedepot zip 90210
python bootstrap_context.py homedepot store_id 0915     # uses STOREID_TO_ZIP map
python bootstrap_context.py tractorsupply zip 77566

# 2) Fast-path fetch (Context-attached, no ceremony, auto-retries on Akamai 403)
python fetch_product.py homedepot zip 90210 \
    https://www.homedepot.com/p/.../320243591

# 3) Full CSV run in parallel
python run_csv.py path/to/customer_input.csv --workers 4
```

## Key implementation details

### Session config (must be exactly this for HD + TSC)
```python
session = bb.sessions.create(
    project_id=PROJECT_ID,
    proxies=[{"type": "browserbase", "geolocation": {...}}],
    browser_settings={
        "verified": True,         # required — windows fingerprint gets 403
        "os": "mac",
        "context": {"id": ctx.id, "persist": True or False},
    },
)
```

### `wait_until` per site
- HD: `domcontentloaded` — the SPA never reaches the `load` event
- TSC: `domcontentloaded` — Forter + SBSD scripts hold `load` open

### Cookies that actually mean "localized"
Trust these — server-rendered `storeName` fields can stay stale.

| Site           | Cookies that matter |
|----------------|---------------------|
| Home Depot     | `DELIVERY_ZIP` + `THD_LOCALIZER` (URL-encoded JSON with `THD_LOCSTORE`) |
| Tractor Supply | `lpStoreNum` + `lpZipCode` + `lpZipCodeNum` |

### Full-DOM capture
HD and TSC PDPs have intersection-observer-triggered lazy-load sections (reviews, recommendations, frequently-bought-together). A single jump-scroll skips them. We instead scroll incrementally (80% viewport / step, 600ms pause), then `wait_for_load_state("networkidle")` before `page.content()` — pulls ~10% more HTML in our testing.

### Proxy geolocation
Browserbase proxies support fine city-level granularity but smaller cities can lack available IPs (`ERR_TUNNEL_CONNECTION_FAILED`). `proxy_geo.py` defaults known ZIPs to the nearest major metro for reliability. Unknown ZIPs fall back to country-only.

### store_id handling
Neither HD nor TSC's locator search box matches by store number alone (we tested — `0915` returns a fuzzy ZIP/city result, not store 0915). Direct `/storeId/<id>` URLs return 404/403. So `proxy_geo.STOREID_TO_ZIP` maps each store_id to a ZIP, then we run the regular ZIP ceremony. Customer extends this map as needed.

## Selling points to highlight

- **Browserbase Contexts** — the architectural win. Persist any browser state (cookies, localStorage, IndexedDB) across sessions, fanout to hundreds of concurrent reads.
- **`verified: true`** — partnership-based anti-detection (Akamai, Cloudflare). The only thing that gets the full 1+ MB product HTML on these sites; non-verified sessions hit the ~3 KB Akamai block page.
- **Browserbase proxies with geolocation** — region-matched IPs so the site's IP-geo sanity checks pass, while the ceremony picks the exact store.
- **Concurrent sessions against one Context** — one localization, many parallel fetches, no cross-talk. Validated end-to-end in this demo.

## Known limitations

1. `proxy_geo.STOREID_TO_ZIP` ships with one verified mapping (HD `0915 → 07088`). The customer needs to fill in their other store IDs once.
2. TSC's store-locator drawer is A/B-bucket-fragile; the diagnostic script (`diag_tsc_steps.py`) screenshots every step so a new bucket regression is fast to debug.
3. Akamai's bot scoring is adaptive — even with `verified: true` you'll see ~10–20% first-attempt 403s on HD. The auto-retry in `fetch_product.py` (fresh session, same Context) brings net success to ~99%.
