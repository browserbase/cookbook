# Plan — June 17 SAMPLE_ORG call

Source requirements: June 10 technical call (Circleback 9519792) + internal identity
threads (#C06U6CM7YS1, June 8–11). Today = Wed June 11. Internal identity sync Fri
June 13 (Peter asked to pull it earlier). SAMPLE_ORG call ~Tue June 17.

**What changed on the call:** Shopee BR (1–2M items target) + Temu (BR/MX) are the
actual evaluation — SAMPLE_ORG has no scraper/provider for Shopee and only a displaceable
provider for Temu. Shein/AliExpress are a *paid-fallback* tier (they run those
internally: AliExpress ~2M/day @ ~50% first-pass + retries, 3–4 min/item timeout;
Shein ~300K/day — NOT 200K as in Nick's Slack recap). Hard new requirement: deliver
**raw data, no pre-parsed output** (their parsers, their schema). Report volumes
**split by process** (P1 listings = weekly, P2 PDP = daily).

**June 17 deliverable:** one benchmark table — per site × per process: items/day,
**first-pass** success (their vocabulary), after-retry success, p50/p95 latency —
side-by-side with their internal baseline; raw-data artifacts in hand; honest
Shopee/Temu access status with the identity-team path.

---

## WS1 — Raw-data delivery (hard requirement; do first, everything reframes around it)

The deliverable per item becomes the **raw artifact**; parsed JSON demotes to bonus.

1. `src/capture/types.ts` — add `rawHtml?: string` (rendered `page.content()`) to
   `CaptureResult`. Every adapter fills it after settle.
2. `src/fetchPdp.ts` — persist per item: `output/payloads/<site>-<cc>-<id>.raw.html`
   + existing `.json` payload + a run **manifest** row (url → artifacts → provenance
   `source` → timings). SAMPLE_ORG integration = "here's the directory + manifest" shape.
3. **AliExpress: flip capture primary.** Raw rendered HTML becomes the payload
   (`source: 'dom:rendered-html'`); Stagehand AI-extract moves behind `--parse`
   as a value-add. Side effect we *want*: removes the Model-Gateway path from the
   scale lane — the README caveat "AI-extract stalls under concurrent load"
   disappears, so AliExpress joins the direct-capture (fast) path for ladders.
4. Shopee (`mfe-initial-data` blob) and Shein (`gbRawData`) already deliver raw
   envelopes — keep, and also persist full page HTML for uniformity.
5. Process 1: persist raw category/listing-page HTML alongside parsed §3.1 fields
   (`rawCardText` already retained — keep).

Acceptance: run `npm run one` per site → raw HTML + envelope on disk; AliExpress
ladder no longer touches the LLM path.

## WS2 — Scale numbers (the headline)

1. `src/stagedRun.ts` — add `--seeds <file>` accepting `output/pdp-urls-*.json`
   (deep-dive output) so ladders run on **real** URLs, not placeholder seeds.
2. **Harvest ≥1,000 real PDP URLs** per priority cell via
   `npm run deep-dive -- --depth 2 --pages N`: AliExpress BR, Shein BR first;
   MX second wave.
3. `src/metrics.ts` / `src/report.ts` — split **first-pass success** vs
   **after-retry success** (maps 1:1 to SAMPLE_ORG's "50% first-pass + retries" framing);
   keep p50/p95 + bytes; extrapolate items/day at measured rate; output the matrix
   **split by process** (P1 listings/week · P2 items/day) per Javier's ask.
4. **Shein concurrency tuning** — 70% @ 10-wide is the open hole (warm-up/load
   sensitivity). Levers: stagger warm-ups, shared warm context per worker, then the
   existing retry-on-empty. Target: pass the ≥95% gate at 100-wide.
5. **Run ladders** `1→10→100→1,000`: AliExpress BR (new raw path), Shein BR,
   Shopee BR P2 (URL pool from WS3). Then `--matrix` refresh for breadth cells.
6. **Ops ask (internal):** raise the 100/min create-burst (caps effective
   concurrency at ~40–58 of the 250) before the 1,000-wide stage.
7. Budget guard: ~$41/1,000-URL run (proxy-dominated) → full week ≈ **$150–250**;
   the gate stops degraded configs before the expensive stages.

Talking-point math for the deck: at measured ~30s/PDP, 1M/day ≈ ~350 concurrent,
2M/day ≈ ~700 — i.e. SAMPLE_ORG's Shopee target is a **plan/concurrency setting**, not a
capability question, *provided* the gate holds at 100→1,000.

## WS3 — Shopee BR (primary target)

1. **Account (two parallel paths):**
   - *External:* explicit ask to SAMPLE_ORG — the Circleback action item ("Camilo provides
     a Shopee BR account") was **never actually voiced on the call**; put it in
     writing via Nick's follow-up email (Slack Connect still blocked on their IT).
   - *Internal:* Amel — Brazil SIM + BR IP from leftover IPRoyal credits. When it
     lands: `npm run bootstrap-shopee` (manual login via live view, persists the
     Context) → validate P1 `npm run deep-dive -- --competitor shopee --country BR
     --level 2 --cats 3` → harvest PDP URLs.
2. **P2 URL pool for the ladder** (don't block on the account): ask SAMPLE_ORG for a
   sample of their matched Shopee IDs/URLs (they said the volume comes from their
   matching process); fallback: probe Shopee's public sitemap. P2 capture itself is
   already proven (SSR = their `get_pc` envelope, 15/15 @ 100% in the matrix run).
3. Confirm **Shopee MX/AR = N/A** (market exit ~2022) with a quick live probe and a
   citable note — Camilo asked for AR/MX "if you can"; the honest answer is that
   only BR exists, and saying so crisply builds trust.

## WS4 — Temu (with the identity team)

1. **Today:** answer Peter's reschedule ask (he pinged Browder+Peyton at 12:03 to
   pull the Friday sync earlier). Bring: requirements summary, `src/probeTemu.ts`
   findings (5/5 blocked, escalating defense), PR #39.
2. Implement the parked levers in `src/capture/temu.ts` + `probeTemu.ts`, informed
   by Peter's reversing (stealth-reversing-toolkit PR #50 — `anti-content` /
   `x-phan-data` carry decryptable mouse/click/screen/headless signals; image
   CAPTCHA decodable; **no VM**; behavioral analysis is the wildcard):
   - **organic warm-up nav** (home → category → PDP, never a cold deep-link),
   - **request pacing** (the defense escalates with hit rate — slow down),
   - **behavioral realism**: human-ish mouse/scroll/dwell via Stagehand act between
     navigations, so the decrypted device-data tells a wholesome story,
   - **auth Context** test (Pylon #19675: Temu login has worked; US account fine),
   - BR residential proxy already in place (Pylon #10075: matching geo is what
     unblocked temu.com/uk).
3. Probe **Temu MX** (call scoped Temu to BR+MX).
4. June 17 framing (Peyton's gate: scope now, buy the solver API only post-signature):
   customer-facing = "dedicated identity workstream engaged, access architecture
   scoped, BR/MX path identified" — show probe telemetry, do **not** promise scaled
   Temu numbers. Internal pricing/solver detail stays internal.

## WS5 — Deck + tracker refresh (`deck/build.js`, `MATRIX.md`, `ACCEPTANCE.md`)

1. Re-order the narrative: Shopee BR + Temu first (the evaluation), Shein/AE as the
   fallback tier. Keep pricing out of the technical deck (Nick's ~$120k Scale A
   anchor is his lane; Javier made price the gate for the fallback tier).
2. **Benchmark slide** (the one slide that matters): ours vs theirs —
   AliExpress: their 50% first-pass / 3–4 min/item vs our first-pass % / ~24–37s;
   Shein: their 300K/day vs our measured capacity. Use **300K** (correct Nick's 200K
   before it propagates).
3. Per-process split table (P1 weekly · P2 daily) — exactly the shape Javier asked
   volumes be reported in.
4. **Raw-data slide:** artifact tour — Shopee SSR blob ≡ their `get_pc` example
   envelope, Shein `gbRawData`, AliExpress raw HTML + manifest. "Your parsers, your
   schema" framing.
5. Honest status slide: Shopee P2 proven / P1 = account (asked + internal SIM path
   running); Temu = anti-bot-gated, identity team engaged, levers in test. Keep the
   gate-stops-degraded-configs frame as the anti-blocking value prop.
6. Regenerate §5 self-assessment + matrix cells from the WS2 runs; rebuild
   `deck/SAMPLE_ORG-Browserbase-POC.pptx` via `deck/build.js`; dry-run Mon June 16.

## WS6 — Asks & coordination (mostly not code)

| Item | Owner | When |
|---|---|---|
| Reply to Peter re: earlier identity sync | Chris | **today** |
| SAMPLE_ORG follow-up email: explicit Shopee BR account ask + sample Shopee URL/ID list + Temu provider's benchmark numbers + confirm Shopee BR-only | Nick (Chris drafts) | today/Thu |
| Brazil SIM + IP (IPRoyal credits) → Shopee signup | Amel (Chris coordinates) | by Fri sync |
| Create-burst raise past 100/min for the 1,000-stage | Chris → BB infra | before Fri |
| Slack Connect unblock (their IT) | Nick ↔ Camilo | ongoing |
| June 17 calendar invite | Nick | this week |

## Day-by-day

- **Wed 6/11** — WS1 (raw capture + AliExpress flip + `--seeds`); reply to Peter;
  draft SAMPLE_ORG email for Nick; ping Amel.
- **Thu 6/12** — URL harvests; Shein concurrency tuning; first ladders (AliExpress
  BR, Shein BR); Temu levers in code; identity sync if pulled earlier.
- **Fri 6/13** — identity sync (default slot); Temu BR retest with levers + MX
  probe; Shopee bootstrap if SIM landed; Shopee P2 ladder on whatever URL pool exists.
- **Sat–Mon 6/14–16** — re-run ladders to pass gates; 1,000-stage where gated-in;
  regenerate MATRIX/§5/ACCEPTANCE; deck rebuild; dry run.
- **Tue 6/17** — call.

## Risks & honest fallbacks

- **Shein stays <95% at width** → present first-pass + after-retry split with the
  gate story (it stops degraded configs — that *is* the anti-blocking answer), and
  note their own internal first-pass is 50%.
- **SIM/account doesn't land by Fri** → Shopee P1 stays "proven, parked on account";
  P2-at-scale rides the SAMPLE_ORG-provided URL sample; the written ask covers us.
- **Temu levers don't clear the gate** → show probe telemetry + identity findings +
  scoped path; no fabricated numbers (Peyton's gate holds).
- **Create-burst not raised in time** → report measured effective concurrency and
  extrapolate to 250 with the caveat labeled.
