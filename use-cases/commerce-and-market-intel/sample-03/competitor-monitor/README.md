# SAMPLE_ORG Competitor Monitor — Browserbase anti-bot-at-scale demo

**Browserbase + Stagehand v3 (TypeScript)** demo for Mercado Libre: capture the **full PDP payload** of competitor product pages (Shopee, Temu, Shein, AliExpress) across five LatAm countries, and prove it **stays unblocked as volume scales** via a staged `1 → 10 → 100 → 1,000` ladder with a block-rate gate between stages.

## What SAMPLE_ORG asked for

SAMPLE_ORG's requirement doc evaluates providers on **extracting and monitoring competitor data at scale** — their stated pain is **getting blocked**. The priority competitors are **Shopee · Temu · Shein · AliExpress** across **Brazil · Mexico · Chile · Colombia · Argentina**. The deliverable per product is the *full PDP API response* — they shipped a real Shopee example (`get_pc_shoee.json`, the `GET /api/v4/pdp/get_pc` payload).

This demo implements **both** of SAMPLE_ORG's processes — **Process 2 (Daily Monitoring via Predefined URLs)** and **Process 1 (Category Deep Dive)** — validated logged-out across **AliExpress (BR/MX/CL/CO/AR)** and **Shein (BR/MX/CO)**, plus **Shopee** (Process 2 in BR ✅; Process 1 parked on Shopee's BR-phone signup wall — account to be provided by SAMPLE_ORG). **Temu**'s PDP is *reachable* logged-out, but its product API (`oak/integration/render`) is **anti-bot-gated (403 + CAPTCHA)** — reframed from "login-gated"; reworked capture tested 5/5 blocked (IP-reputation-sensitive), parked with clear next levers. Full per-competitor × country status — including honest *N/A* calls — lives in **[ACCEPTANCE.md](ACCEPTANCE.md)**, which maps every requirement-doc criterion to its state.

> Note on "at scale": the requirements doc does **not** specify a volume target — it asks suppliers to *self-report* capacity/SLA/concurrency (§5) and to demonstrate the capabilities + fill a competitor×country matrix (§7/8). So this build is **acceptance-first** (cover the defined criteria), with the `1→1,000`+extrapolation ladder as an upside story, not a gate.

## What it proves

The headline is **anti-bot reliability as volume grows**. Each stage reports:

- **success / block / empty rate** and **CAPTCHA solve rate**
- **p50 / p95 URL elapsed latency** and **observed bytes per attempt / URL**
- a **gate**: only advance to the next stage if success ≥ threshold (default 95%) — otherwise stop and iterate stealth/proxy, so you **never burn 1,000 sessions to discover stage 100 was already blocked**
- after 1,000, an **extrapolation to 100,000** (wall-clock, proxy GB, cost) — you prove the curve, not the bill
- a **SAMPLE_ORG Baseline Evaluation Matrix** (competitor × country) that directly answers SAMPLE_ORG's supplier questionnaire (daily capacity, SLA, concurrency)
- **first-pass vs after-retry success** split — SAMPLE_ORG's own benchmark vocabulary (their internal AliExpress scraper runs ~50% first-pass + heavy retries)
- **raw-data delivery** (June 10 call requirement): every ok fetch persists the rendered-page HTML (`output/payloads/*.raw.html`) next to the data envelope where one exists, indexed by an append-only **`output/manifest.jsonl`** (url → artifacts → provenance → timings) — SAMPLE_ORG applies their own parsers; structured extraction is opt-in (`--parse`), never the deliverable

## How it works (and one important detail)

```
seeds/urls.json ─▶ stagedRun.ts  (ladder + gate + extrapolate, or --matrix sweep)
                        │  per stage of N URLs, at bounded concurrency:
                        ▼
                   runStage.ts ─▶ fetchPdp.ts ─▶ session.ts
                        │                          ├─ Stagehand owns the Browserbase
                        │                          │  session (verified stealth + per-
                        │                          │  country residential proxy)
                        │                          └─ raw Playwright page over CDP  ◀── capture
                        │             ├─ capture/<competitor>.ts  (intercept XHR | read inline global)
                        │             ├─ blockDetect.ts           (403/429/challenge + captcha events)
                        │             └─ retry on block w/ FRESH session (= fresh IP)
                        ▼
                   metrics.ts ─▶ report.ts  ─▶  console + output/run-<ts>.json
```

**The important detail:** Stagehand v3 is CDP-native and its `page` object **does not expose `page.on('response')` / `page.route()` / console listeners** — and we need all of them (intercept XHRs, count CAPTCHA-solve console events, meter bytes, block heavy assets). So we let Stagehand own the session (stealth, proxy, Model-Gateway for Process 1) and attach a **second, passive raw-Playwright page over CDP to the same session** for capture. The same pattern appears in the [related operations demo](../../../sales-support-and-ops/sample-01/demo/index.ts). See [`src/session.ts`](src/session.ts).

> **First-run finding (Shopee):** the `get_pc` API is anti-scrape protected — for automated-looking requests it returns HTTP 200 with an *encrypted/withheld* body (`error 90309999`, numeric-keyed), not the product. But `verified` stealth renders the real PDP with no CAPTCHA, and Shopee server-renders the full product into a `<script type="text/mfe-initial-data">` blob. The Shopee adapter captures that SSR payload (structurally identical to the `get_pc` `data` envelope — `item`/`product_price`/`product_review`/…) and falls back to `get_pc` only when a product/IP returns it clean. This *is* the resilient-capture thesis: when the API is locked down, the rendered page still carries the data.

## Anti-bot configuration

Set in [`src/session.ts`](src/session.ts) on every session:

```ts
browserSettings: { verified: true, solveCaptchas: true, blockAds: true, ... }
proxies: [{ type: 'browserbase', geolocation: { country: 'BR', city: 'SAO_PAULO' } }]
```

- **`verified: true`** — Browserbase's managed advanced-stealth Chromium with real fingerprints (Scale plan).
- **`solveCaptchas: true`** — auto-solve; we count `browserbase-solving-started/finished` console events as the CAPTCHA-solve metric.
- **residential proxy geolocated per country** (BR/MX/CL/CO/AR) — the exit IP the site geo-checks. Region pins to `us-east-1`; the LatAm IP comes from the proxy (see note in [`src/config.ts`](src/config.ts)).
- **retry-on-block** spins up a fresh session (fresh IP) — the lever that turns intermittent blocks into eventual success.

## Capture per competitor

Three distinct capture modes, each matched to what the site actually does (all validated live except Temu). The point: *clean data where the site exposes it, AI extraction where it doesn't — one pipeline.*

| Competitor | Where the data lives | How we capture it | Status |
|---|---|---|---|
| **Shopee** | SSR `<script type="text/mfe-initial-data">` (the `get_pc` XHR is anti-scrape locked → encrypted `error 90309999`) | parse the SSR blob, locate the `item` envelope; opportunistic `get_pc` when clean | ✅ real payload |
| **Shein** | inline `window.gbRawData` (`modules.{productInfo,priceInfo,…}`) | resilient hydration-wait probe, **after a homepage warm-up** (Shein only SSRs for a warmed session) | ✅ real payload |
| **AliExpress** | rendered DOM (`window.runParams` is now an empty `{}` — fully CSR) | **rendered-page raw HTML** (product-title hydration gate); optional Stagehand `extract` via `--parse` | ✅ real payload |
| **Temu** | product API `oak/integration/render` (the `_oak_*` PDP framework; `__CHUNK_DATA__`/`rawData` proved shell-only/absent) | intercept the `oak/render` XHR + CAPTCHA-solve-wait + fresh-IP retry | ⚠️ anti-bot-gated (403 + CAPTCHA even logged-out) — rework underway |

Each is a small `CompetitorAdapter` in [`src/capture/`](src/capture); adding a site = adding one file. Adapters that need AI receive the Stagehand instance via the capture context.

## Quick start

```bash
cd commerce-and-market-intel/sample-03/competitor-monitor
npm ci
npm test
cp .env.example .env        # add BROWSERBASE_API_KEY + BROWSERBASE_PROJECT_ID
```

**1 — Smoke test (one URL):**
```bash
npm run one -- "https://shopee.com.br/Kit-3-Lava-Roupas-L%C3%ADquido-Baby-Soft-Total-Max-3L-Verde-i.534023108.22597600131"
```
Prints the live-view URL (watch stealth/CAPTCHA in real time), the captured `source`, and writes the payload to `output/payloads/`. Diff it against `get_pc_shoee.json` to confirm structural parity.

**2 — The ladder (the main event):**
```bash
npm start -- --competitor shopee --country BR --stages 1,10,100
# full ladder + 100k extrapolation:
npm start -- --competitor shopee --country BR
```

**3 — Matrix sweep (fill SAMPLE_ORG's grid):**
```bash
npm start -- --matrix 10
```

Flags: `--competitor --country --stages 1,10,100,1000 --workers 10 --threshold 0.95 --max 100`. Run `npm start -- --help` for all.

## The staged philosophy

The ladder exists to **conserve resources and fail fast**. Stages run in order; each gates on success rate before the next, larger (and more expensive) stage runs. If Shopee starts blocking at stage 100, you learn it after roughly 111 URL tasks, plus any retries. Once the 1,000 stage clears the gate, the **100k tier is extrapolated** from its measured latency/bytes/success rather than actually run — estimating throughput under the measured conditions.

## Cost model

Estimates sum each allocated attempt separately, including retries, using the configured compute and proxy rates with assumed minimums of one rounded-up minute and one rounded-up MB per attempt. These are configurable modeling assumptions, not verified billing rules or a current price quote. Confirm rates and metering with your contract. If any attempt lacks a session ID, cost is `null` (printed as `unknown`) because allocation and billing cannot be established.

`durationMs` is the sum of observed attempt work before teardown. `elapsedMs` measures the full URL task through awaited teardown; each `attemptHistory` entry preserves both timings, observed bytes, CAPTCHA counts, outcome and session ID. Final outcome and artifact paths still describe the last attempt. The manifest retains the history and aggregate totals.

Stage reports distinguish measured stage wall time, mean/p50/p95 URL elapsed time, summed attempt work, `avgBytesPerAttempt` and `avgBytesPerUrl`. Extrapolation uses whole-URL elapsed time and bytes including retries, a hypothetical URL-worker concurrency, `perUrlCostUsd`, and `expectedSuccessfulUrls`. Matrix daily capacity uses mean URL elapsed time and reports attempted URLs separately from expected successful URLs. These estimates assume the measured workload and success rate hold; they do not establish an SLA.

Historical records with multiple attempts but no complete attempt history cannot recover lost work; aggregation rejects them with an explicit error. Rerun those measurements. Old single-attempt records remain usable. Report consumers must migrate from `totalSessionAttempts`, `avgBytesPerSession`, and `perSessionCostUsd` to `totalAttempts`, `avgBytesPerAttempt` / `avgBytesPerUrl`, and `perUrlCostUsd` respectively.

Traffic remains an observation, not invoice metering: CDP response bytes may exclude other traffic, and the existing raw-HTML-size fallback is an approximation. Attempt elapsed time includes connection and cleanup overhead, while timed-out or unconfirmed remote cleanup may outlive local observation. Allocation failures and missing counters cannot establish zero billed work. The revised accounting preserves recorded retries; it does not reconstruct unobserved remote resource use.

Run `node --test tests/retries.test.mjs` with Node 24 for synthetic retry, cost-rounding, manifest, report and extrapolation checks. No marketplace, Browserbase or billing APIs are called by these tests.

## Caveats

- **Scale-plan gating:** `verified` stealth and 1,000+ concurrency require the Browserbase **Scale plan**. On lower tiers the ladder still runs but caps at your concurrency limit.
- **`connectURL()`:** the CDP side-channel resolves Stagehand's connect URL across v3 minors with a documented-format fallback. If the listener ever fails to attach, that's the first place to look ([`src/session.ts`](src/session.ts)).
- **Temu global name:** `__CHUNK_DATA__` (from SAMPLE_ORG's doc) is unconfirmed publicly; the resilient probe + logging absorbs the drift.
- **Seed placeholders:** only the Shopee BR + Temu BR seeds are real PDPs (from SAMPLE_ORG's doc). Shein/AliExpress/other-country rows are clearly-marked placeholders — replace them in [`seeds/urls.json`](seeds/urls.json) with real PDP URLs.
- **DOM/anti-bot drift:** adapters are isolated, so one site breaking doesn't sink the run — the matrix shows per-cell health.

## File map

| File | Purpose |
|---|---|
| `src/stagedRun.ts` | CLI: the ladder (gate + extrapolate) and `--matrix` sweep |
| `src/fetchPdp.ts` | one URL: session → navigate → capture → classify → retry; also the `npm run one` CLI |
| `src/session.ts` | Stagehand owns the BB session (stealth+proxy); raw Playwright over CDP for capture |
| `src/capture/*` | per-competitor capture adapters + registry |
| `src/blockDetect.ts` | ok/blocked/empty classification + CAPTCHA telemetry |
| `src/runStage.ts` | bounded-concurrency fan-out for a stage |
| `src/metrics.ts` | per-stage aggregation, 100k extrapolation, SAMPLE_ORG matrix |
| `src/report.ts` | console summaries + `output/run-<ts>.json` |
| `src/proxyGeo.ts` / `src/config.ts` | per-country proxy geo · env + tunables |
| `seeds/urls.json` | the predefined PDP URLs (Process-2 input) |
| `src/context/*` | Browserbase Context store + one-time login bootstrap + country-coupled attach (Process 1) |
| `src/categories/extract.ts` | generic category-tree + §3.1 listing extractors (per-competitor spec) |
| `src/deepDive.ts` | CLI: deep-dive (auth Shopee / logged-out AliExpress·Shein) → §3.1 listings → PDP URLs into Process 2 |

## Process 1 — Category Deep Dive

SAMPLE_ORG's Process 1 walks the competitor's category tree, extracts every listing (§3.1 fields), and feeds the discovered PDP URLs into the Process-2 engine above. One generic extractor ([`src/categories/extract.ts`](src/categories/extract.ts)) drives every competitor via a per-site spec (category/product link patterns); [`src/deepDive.ts`](src/deepDive.ts) crawls *until N non-empty categories* (skipping personalized feeds / empty pages).

**Login footprint (probed live):** AliExpress + Shein browse **logged-out**. **Shopee** P1 browsing is login-gated — and signup hits a **BR-phone wall** (US OTP undeliverable), so an account must be supplied. **Temu**'s PDP is *reachable* logged-out, but its product API is **anti-bot-gated** (403 + CAPTCHA). See [ACCEPTANCE.md](ACCEPTANCE.md).

**AliExpress / Shein — no account needed (validated logged-out):**
```bash
npm run deep-dive -- --competitor aliexpress --country BR      # 77 listings → pdp-urls-aliexpress-BR.json
npm run deep-dive -- --competitor shein --country MX           # 150 listings (www.shein.com.mx)
npm run deep-dive -- --competitor shein --country BR --depth 2 --pages 2   # L2 descent + pagination (exhaustive, slower)
```
Validated breadth: **AliExpress BR/MX/CL/CO/AR** (localized currencies) · **Shein BR/MX/CO** (Shein CL = geo-landing only, AR = no storefront → *N/A*). Captures §3.1 — Product URL · Image · Title · Price · Units sold · and **parsed Offers / Discounts / Promotions / Badges** (bilingual PT/ES, multi-currency `R$`/`MX$`/`$MXN`/`$`; `rawCardText` retained as source) — writes `output/deepdive-*.json` and emits `output/pdp-urls-<competitor>-<country>.json`, a ready Process-2 input list. Host/locale is **country-aware** (AliExpress `pt`/`es`; Shein per-country hosts). `--depth 2` descends L1→L2 subcategories and `--pages N` paginates (the §2.1 "all categories / all pages" claim); both are opt-in and slower, so the default is a fast representative sample. (AliExpress's homepage exposes few category links → falls back to search-as-category.)

**Shopee / Temu — authenticated Context.** Shopee's logged-out category page redirects to `/verify/traffic/error` and the listing API returns the same `error 90309999` encryption seen on `get_pc`. So they need the Browserbase **Context** "bootstrap once, reuse" pattern:
```bash
npm run bootstrap-shopee     # one-time: log in by hand via the live view (handles SMS OTP); persists a Context
npm run deep-dive -- --competitor shopee --country BR --level 2 --cats 3
```

**Multi-country coupling.** A Context, its proxy geo, the account, and the target domain must all agree on country — the unit of management is **(competitor, country)**. You can't share a login across countries: Shopee BR (`shopee.com.br`) and Shopee MX (`shopee.com.mx`) are different domains/accounts, and replaying a BR cookie over an MX IP triggers geo-mismatch step-up auth + returns wrong-locale data (currency/catalog). So you bootstrap + crawl each country separately, and `attachCountryContext()` (in [`src/context/attach.ts`](src/context/attach.ts)) derives **both** the Context lookup and the proxy geo from one `country` value so they can't drift. Reality check: Shopee in LatAm is effectively **BR-only** (it exited CL/CO/MX/AR), so its other-country matrix cells are likely *N/A* — the genuine multi-country breadth is Temu/Shein/AliExpress (one global domain + locale path + ship-to, still one Context per country). For logged-out **Process 2**, there's no Context, but the proxy geo still must match each URL's country — already handled, since every seed row is tagged with its country and `fetchPdp` sets the proxy from it.

**Next** (full tracker in [ACCEPTANCE.md](ACCEPTANCE.md)): *active / account-free* — the **§5 capacity/SLA/concurrency self-assessment** (one modest staged run on AliExpress/Shein) + Shein P2 in MX/CO. *Parked at clean checkpoints* — **Shopee P1** (capture proven; blocked on Shopee's BR-phone signup wall → SAMPLE_ORG to provide an account/number) and **Temu** (capture reworked to intercept `oak/render`, tested 5/5 blocked / IP-reputation-sensitive; untried levers: warm-up nav + auth Context + pacing). *Upside* — the `1→1,000` ladder + 100k extrapolation (not a doc requirement) and the *online* SAMPLE_ORG-ecosystem delivery shape (design with the customer).

## Capture validation (local regression checks)

AliExpress keeps raw HTML as the default capture. Opt-in parsing validates Stagehand's `response.data` against the product schema and persists only that product object. Missing, malformed, or untitled extraction results retain the raw-only outcome; provider error details are omitted.

Shopee accepts an XHR or SSR product only when its item has a positive integer identity. String IDs preserve their precision; conflicting aliases and unsafe numeric IDs are rejected. Unrelated SSR scripts do not stop the search. Empty objects cannot report a successful product capture, and the response listener is removed even when collection throws. Identity validation does not establish product completeness or freshness.

Run `node --test tests/capture.test.mjs` with Node 24 and this recipe's dependencies installed. The 33 synthetic regression cases exercise extraction envelopes, artifact persistence, SSR/XHR identity checks, classification, and listener cleanup. An isolated type check used Stagehand 4.0.2 and the installed Playwright types. These checks did not contact marketplaces, Browserbase, or a model, and do not establish live compatibility or a full recipe build.
