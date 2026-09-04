# SAMPLE_ORG — Baseline Evaluation Matrix (§7 / §8)

Browserbase + Stagehand: competitor PDP **extraction (Process 1 — Deep Dive)** and
**monitoring (Process 2 — Daily URLs)** across Brazil · Mexico · Chile · Colombia · Argentina.
Filled from live validation — per-criterion detail in [ACCEPTANCE.md](ACCEPTANCE.md).

> **The frame:** capture is **reliable per-session (100%)**. Where volume exposes a weak
> spot, the pipeline's **≥95% success gate stops it *before* it scales** — so you never
> blindly burn sessions getting blocked. **Resilience is the design; throughput is a plan
> setting (concurrency).** That gate-on-degradation *is* the answer to "getting blocked at
> scale" — the system knows its limits instead of failing silently at volume.

**Legend:** ✅ validated live · ⚠️ partial / anti-bot-gated · ⛔ blocked (account/region) · ⏭️ N/A (market closed)

| Competitor | Site / Country | Deep Dive Capacity | DD Frequency | Daily Monitoring Capacity | Daily Frequency |
|---|---|---|---|---|---|
| **Shopee** | Brazil | ⛔ needs account¹ | monthly\* | ✅ SSR `mfe-initial-data` | daily |
| **Shopee** | Mexico | ⏭️ | — | ⏭️ | — |
| **Shopee** | Chile | ⏭️ | — | ⏭️ | — |
| **Shopee** | Colombia | ⏭️ | — | ⏭️ | — |
| **Shopee** | Argentina | ⏭️ | — | ⏭️ | — |
| **Temu** | Brazil | ⛔ login + anti-bot² | — | ⚠️ anti-bot² | — |
| **Temu** | Mexico | ⛔ | — | ⚠️ | — |
| **Temu** | Chile / Colombia / Argentina | ⛔ | — | ⚠️ | — |
| **Shein** | Brazil | ✅ (288 listings) | monthly | ✅ `gbRawData` | daily |
| **Shein** | Mexico | ✅ (150 listings) | monthly | ✅ `gbRawData` | daily |
| **Shein** | Colombia | ✅ (95 listings) | monthly | ✅ `gbRawData` | daily |
| **Shein** | Chile | ⏭️ landing only | — | ⏭️ | — |
| **Shein** | Argentina | ⏭️ no storefront | — | ⏭️ | — |
| **AliExpress** | Brazil | ✅ (77 listings) | monthly | ✅ AI-extract³ | daily |
| **AliExpress** | Mexico | ✅ (123 listings) | monthly | ✅ MX$ localized³ | daily |
| **AliExpress** | Chile | ✅ (59 listings) | monthly | ✅ CLP localized³ | daily |
| **AliExpress** | Colombia | ✅ (66 listings) | monthly | ✅ COP localized³ | daily |
| **AliExpress** | Argentina | ✅ (67 listings) | monthly | ✅ ARS localized³ | daily |

¹ Shopee BR signup requires a Brazilian phone (US OTP undeliverable; virtual numbers blocked) → **SAMPLE_ORG to provide an account**. Capture is built + the crawler proven; **Process 2 already ✅** (the SSR payload matches SAMPLE_ORG's `get_pc` example envelope).
² Temu PDP is reachable logged-out, but the product API `oak/integration/render` returns **403 + CAPTCHA**; capture reworked to intercept it, parked pending warm-up/auth/pacing levers.
³ AliExpress is fully client-rendered (no inline data blob), so the deliverable is the **rendered-page raw HTML** (per SAMPLE_ORG's raw-data contract — they apply their own parsers), gated on product-title hydration. Optional `--parse` adds Stagehand AI extraction off the scale path. (Previously AI-extract by default — that throughput caveat no longer applies; re-measured in the §5 scale runs.)
\* Frequency capable the moment an account is provided.

---

## Capacity / SLA — §5, measured live (Shein BR, direct-capture path)

| Metric | Measured |
|---|---|
| Per-URL latency | ~24–37 s/PDP (warm-up + capture) |
| Bytes / session | ~5 MB (proxy bandwidth) |
| Success @ 1-wide | **100%** (uncontended) |
| Success @ 10-wide | 70% first-pass → recovered via retry-on-empty (warm-up/load sensitivity is the open tuning area) |
| Concurrency | 250 (account) · ~40–58 effective (100/min create-burst is the next lever) |
| Daily volume | **~430–620k URLs/day** at 250 concurrent (concurrency-bound, i.e. a plan setting — not capability-bound) |

**Reliability design (the answer to "getting blocked at scale"):** every stage reports
success / block / empty / CAPTCHA rates; a **≥95% gate** sits between scale tiers, and
blocks **and** empties retry on a **fresh IP**. The ladder **stops** a degraded config before
it scales — so you never burn 1,000 sessions to discover tier-100 was already failing.
