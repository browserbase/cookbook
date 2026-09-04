# SAMPLE_ORG Acceptance Tracker

Turns the requirements doc (`requeriment_asian_player_temu_shopee.pdf`) into checkable
acceptance criteria + the **competitor × country coverage matrix** SAMPLE_ORG scores on
(§7/8). Update cells as capabilities are validated live.

**Strategy — acceptance-first.** The doc defines *capabilities and a matrix*, not a
scale number. So we satisfy every defined criterion across the required
competitors/countries and fill the matrix **first**; scale is an upside story (the
doc only asks us to *self-report* capacity/SLA/concurrency in §5, not hit a target).

**Legend:** ✅ validated live · 🟡 built, not validated · ❌ not started · ⛔ blocked (needs account) · ⚠️ reachable but data anti-bot-gated (rework underway) · ⏭️ N/A (market closed)

---

## Coverage matrix (§7/8 — the scored deliverable)

Process 1 = Category Deep Dive · Process 2 = Daily URL Monitoring. Capture mode in parens.

| Competitor | Country | P1 (Deep Dive) | P2 (Daily Monitoring) | Notes |
|---|---|---|---|---|
| **Shopee** | BR | ⛔ acct wall | ✅ (SSR `mfe-initial-data`) | **P2 done** (SSR payload = SAMPLE_ORG's `get_pc` example envelope; `get_pc` itself anti-scrape locked → SSR equivalent). **P1 capture built + crawler proven, parked on account acquisition:** Shopee BR signup requires a 🇧🇷 phone — a US number is accepted for *format* but its OTP is undeliverable, and virtual numbers are blocked. Unblocks the moment an authenticated session exists → **SAMPLE_ORG to provide a Shopee BR account / number** (they're Brazilian; standard for the gated competitors). |
| **Shopee** | MX/CL/CO/AR | ⏭️ | ⏭️ | Shopee exited Spanish LatAm (~2022) — confirm with SAMPLE_ORG |
| **Shein** | BR | ✅ (171 listings) | ✅ (`gbRawData` + warm-up) | |
| **Shein** | MX | ✅ (150 listings) | ✅ (`gbRawData`) | both validated live |
| **Shein** | CO | ✅ (95 listings) | ✅ (`gbRawData`) | both validated live — P2 needed the country-correct warm-up fix (see below) |
| **Shein** | CL | ⏭️ landing only | ⏭️ | `www.shein.cl` = geo-landing, no category browse |
| **Shein** | AR | ⏭️ N/A | ⏭️ | no Shein storefront (parked domain / import-restricted) |
| **AliExpress** | BR | ✅ (77 listings) | ✅ (Stagehand `extract`) | |
| **AliExpress** | MX | ✅ (123 listings) | ✅ localized **MX$113.90** | `es.aliexpress.com` |
| **AliExpress** | CL | ✅ (59 listings) | ✅ localized **CLP $941** | |
| **AliExpress** | CO | ✅ (66 listings) | ✅ localized **COP $24.587** | |
| **AliExpress** | AR | ✅ (67 listings) | ✅ localized **ARS $12.381** | |
| **Temu** | BR (probed) | ⛔ (login) | ⚠️ anti-bot | PDP **reachable logged-out**, but product API `oak/integration/render` → **403 + CAPTCHA**. Adapter reworked to intercept `oak/render` + fresh-IP retry; **tested 5/5 blocked** — defense **escalates with repeated hits** (shell → 403+CAPTCHA → hard `forbidden`), i.e. IP-reputation-sensitive. Brute retry insufficient. Next levers: warm-up nav + **auth Context** + pacing. |
| **Temu** | MX/CL/CO/AR | ⛔ | ⚠️ | same anti-bot mechanism expected; not yet probed |

---

## §2.1 + §3 — Process 1 (Category Deep Dive)

- [x] **Category tree at a stated level (L1 / L1+L2 / L1+L2+L3)** — ✅ L1+L2 demonstrated (`--depth 2`: 52 L1 → +82 L2 subcategories on Shein BR); L3 reachable by deeper descent. Shopee's `cat.` tree already exposes L1/L2/L3.
- [x] **Extract listings (§3.1)** — ✅ AliExpress BR/MX/CL/CO/AR · Shein BR/MX/CO (logged-out)
- [x] **Access the PDP of each listing** — ✅ (PDP URLs emitted → Process 2)
- [x] **Consume PDP API + obtain full response** — ✅ (3/4 competitors)
- [x] **ALL pages within each category (pagination)** — ✅ demonstrated (`--pages N` via `?page=`; Shein BR 230+58 across 2 pages). Full-tree exhaustion is opt-in (`--depth`/`--pages`/`--cats`) and slower; the default stays a fast representative sample.

## §3.1 — Category/listing fields

- [x] Product URL · Image URL · Title · Price · **Units sold** — ✅
  - **Image URL (verified 2026-06-11):** we capture image **URLs/refs**, not image **binaries** — exactly what §3.1 ("Image URL") and §3.2 ("full API response") ask for. P1 listing fill rate: Shein **100%**, AliExpress **~92%** (lazy-load thumbs that hadn't swapped `data-src`→`src` at harvest — fix: read `imagePathList` from embedded JSON or scroll more). P2 PDP payloads carry the **full gallery**: Shopee `item.images[]`+`gallery_contents`, Shein `goods_image`/`allColorDetailImages` (42 refs in sample), AliExpress raw HTML `og:image`+126 `alicdn` URLs+`imagePathList`. NOTE: P2 `blockHeavyAssets` aborts image *bytes* to hold ~5 MB/session — URLs still survive in the data blob/HTML (they're text, not downloads). If SAMPLE_ORG ever wants the actual image files (unlikely — they want raw data for their own parsers), it's a one-line change with a large bandwidth-cost impact → confirm on the call.
- [x] **Offers / Discounts / Promotions / Badges** — ✅ parsed into discrete fields, **bilingual (PT/ES)** and **multi-currency** (R$ / MX$ / $MXN / $); `rawCardText` retained as source. Price coverage ~90–100% across BR+MX (free shipping, "Economize/Ahorra R$X", coupon, "-67%", best-seller rank, "almost sold out", Choice, #hashtags)

## §3.2 — PDP-level (full API response + 4 validation goals)

- [x] **Full payload delivered** — ✅ Shopee (SSR) · Shein (`gbRawData`) · AliExpress (raw rendered HTML; `--parse` AI extract optional) · ⚠️ Temu (page loads logged-out, but product API `oak/integration/render` → 403 + CAPTCHA — capture rework underway)
- [x] **Raw-data delivery (June 10 call requirement)** — ✅ every ok fetch persists `*.raw.html` + envelope `.json` (where the site exposes one) + an `output/manifest.jsonl` row; SAMPLE_ORG parses with their own pipeline. P1 likewise saves raw listing-page HTML (`p1-*-p<n>.raw.html`).
- **API Accessibility** — ⚠️ the *raw* endpoints are largely defended (Shopee `get_pc` encrypted `90309999`; AliExpress `runParams` empty/CSR; **Temu `oak/integration/render` → 403 + CAPTCHA even logged-out**). We deliver the **complete data via SSR / AI-extract instead** — frame this explicitly to SAMPLE_ORG rather than promising a raw `get_pc` JSON. The Temu route is the open one (intercept `oak/render` once a clean session/CAPTCHA-solve clears it).
- **Attribute coverage** — ✅ full payloads (Shopee 40 KB, Shein 245 KB) / structured extract (AliExpress)
- **Extraction stability** — 🟡 single-run; **CAPTCHA-wait + retry-on-unsolved-CAPTCHA** added (recovered MX & CO in the breadth run, 4/4); not yet exercised at high volume
- **Integration capacity** — 🟡 batch via CLI + structured JSON output; the SAMPLE_ORG-ecosystem *delivery shape* is a deliberate next step to scope with the customer (see §4)
- Temu target `__CHUNK_DATA__`/`rawData` — ✅ **probed live, logged-out** (2 runs, BR): the PDP page *renders* (correct title), but `__CHUNK_DATA__`/`rawData` are **shell-only or absent** and the product API `oak/integration/render` returns **403 + CAPTCHA** (`api/phantom/obtain_captcha` served ~190–227 KB; `passport/token/touch` → 424). **Reframed: anti-bot-gated, not (only) login-gated.** Adapter **reworked** (intercept `oak/render`, signal blocks so the outer loop retries) + **tested with up to 5 fresh-IP retries → 5/5 blocked**, escalating to a hard `forbidden` with no CAPTCHA offered. **Brute fresh-IP retry is insufficient, and repeated hits degrade IP standing** (the defense escalated across our 3 runs). Remaining levers (parked, account-free first): **warm-up navigation** (organic homepage→PDP, not a cold deep-link), then a **logged-in Context** (the `passport 424` hint), then **request pacing**. Diagnostic: `src/probeTemu.ts`; capture: `src/capture/temu.ts`.

## §4 — Process 2 (Daily Monitoring)

- [x] Access predefined URLs · consume PDP API · full response — ✅ (3/4)
- [x] **Batch** integration — ✅ (`stagedRun` over a URL list + single-URL CLI)
- [ ] **Online** (on-demand service) integration — ⏭️ deferred (a prototype HTTP endpoint was spiked, then removed pending design)
- [ ] **Integrate extracted data into the SAMPLE_ORG ecosystem daily** — ⏭️ **next step to scope WITH the customer** — delivery shape (API / webhook / file drop / queue) + scheduling TBD with their team

## §5 — Frequency self-assessment ("supplier must indicate")

> **Account entitlement:** initial eval project was capped at **10 concurrent / 5 creates-per-min** (429s — this, not anti-bot, throttled the first runs). Bumped to **250 concurrent / 100-per-min** for the scale ladder. Note: even at 250, the **100/min create-burst caps effective concurrency to ~40–58** for ~30s sessions — raise the burst further to drive the full 250-wide.

- **§5.1 Deep Dive (monthly):** per deep-dive ~37s for 2 non-empty categories (Shein/AliExpress, logged-out); full-tree time scales with `cats × pages`. Multiple monthly executions ✅ feasible.
- **§5.2 Daily Monitoring (daily) — measured live (Shein BR, direct-capture path), `--stages 1,10,100`:**
  - **Per-URL SLA:** ~24–37s/PDP (homepage warm-up + capture) · ~5 MB/session.
  - **Success vs concurrency:** **100% @ 1-wide** (24.6s) → **70% @ 10-wide** — Shein's SSR globals miss on a fraction of concurrent fetches (warm-up/load sensitivity; empties cluster on the slow/lighter responses). **`empty` is now retried on a fresh session** (resilient-capture lever) which recovers most; the residual is the open tuning area (stagger warm-up / per-country context warm-up / more retries).
  - **The ladder GATE correctly stopped at stage 10** (70% < 95%) — the fail-fast design working: it refuses to scale a degraded config rather than burn 100→1000 sessions to find out. *This gating-on-success-rate is itself the answer to SAMPLE_ORG's "getting blocked at scale" pain.*
  - **Max volume/day:** matrix projects **~620k/day at 250 concurrent** at the measured p50; success-rate-adjusted (~70% @ 10-wide today) ≈ ~430k/day until Shein concurrency reliability is tuned up. Capacity is concurrency-bound (plan setting), not capability-bound.
  - **Caveat (resolved 2026-06-11):** the AI-extract path (AliExpress) was slower and stalled under concurrent load. AliExpress now defaults to **raw rendered-HTML capture** (per SAMPLE_ORG's raw-data requirement) — no LLM round-trip on the scale path; AI extract is `--parse` opt-in. Direct-capture (Shein `gbRawData`, Shopee SSR — 15/15 @ 100% in the matrix) plus raw-HTML AliExpress is the high-throughput lane; re-measure AliExpress concurrency in the §5 scale runs.

---

## Status

**Done (no-account acceptance base):** country breadth (AliExpress ×5, Shein BR/MX/CO; Shopee BR; CL/AR & Shopee-non-BR honestly N/A) · §3.1 fields incl. parsed tags (bilingual, multi-currency) · §3.2 full-payload capture for 3/4 competitors via 3 modes (SSR / inline-global / AI-extract) · Process 1 exhaustiveness (L2 descent + pagination) · CAPTCHA-aware retry.

**Remaining — next session (priority order):**

*Active / account-free (what we can finish now):*
1. **§5 self-assessment numbers** — one modest staged run on the working competitors (AliExpress/Shein) to generate daily URL capacity / max-vol / SLA / concurrency, filling the matrix's empty frequency columns (§5.2 is a doc requirement). **← current focus.**
2. **Minor** — Shein P2 in MX/CO (same `gbRawData` mechanism as BR, just not yet run).

*Parked at clean checkpoints (today's live findings):*
3. **Shopee P1** — capture built + crawler proven; **blocked on account acquisition** (Shopee BR signup needs a 🇧🇷 phone — US OTP undeliverable, virtual numbers blocked). Unblocks the instant a Shopee BR session exists → **SAMPLE_ORG to provide an account / number**.
4. **Temu** — adapter reworked to intercept `oak/render`; **tested 5/5 blocked**, defense escalates with repeated hits (IP-reputation-sensitive). Brute fresh-IP retry insufficient. Untried levers: warm-up nav (organic homepage→PDP), **auth Context**, request pacing.

*Upside / later:*
5. **Scale** — the 1→1,000 ladder + 100k extrapolation. *Not a doc requirement; upside/confidence once acceptance is met.*
6. **Integration delivery** — design the SAMPLE_ORG-ecosystem delivery shape **with the customer** (deferred by decision).
