# Validation — OpenTable skill matrix test (2026-04-21)

Evidence that `skill/SKILL.md` + `skill/references/` execute correctly against live OpenTable.

## Build provenance

The recipe was originally auto-generated via Browserbase's `autobrowse` self-improvement loop on 2026-04-17. Autobrowse's inner-agent + outer-agent cycle produced a passing end-to-end booking on iteration 2 (a real reservation at Lao Table). The resulting `strategy.md` was hand-graduated into the skill file you see today.

Between that first graduation and this validation run, the recipe was tightened as follows:
- Documented 4 time-slot button label variants (simple, simple+points, tiered, tiered+points) after encountering the tiered variant on Precita Social / Cucina Venti cuisine-search results.
- Documented 3 booking-flow URL path variants (`/booking/details`, `/booking/seating-options`, `/booking/specials`) after manually probing State Bird Provisions (CC-hold) and TAO Downtown NYC (experience packages).
- Captured the Akamai homepage-warmup workaround — cold Browserbase sessions that navigate directly to `/s?` get 403'd, but loading `/` first lets Akamai's bot manager evaluate the browser and then `/s?` passes.
- Caught a hydration-timing bug during today's regression check: OpenTable's `/s?` page fetches availability via XHR ~10s after `load` fires; the original 8s sleep was racing the render. Fix: 15s (with safety margin).

## Matrix test — 2026-04-21

Three tasks run through `autobrowse` in multi-task mode against live Browserbase remote sessions. Each task had a 5-iteration budget; all three passed on iteration 1 so no strategy iteration was needed.

| # | Task | Goal | Result | Turns | Cost (LLM) |
|---|---|---|---|---|---|
| 1 | `opentable-sf-cc-required` | Detect `/booking/seating-options` + `creditCardRequired=true` at a known CC-hold SF venue. **Read-only — STOP before commit.** | ✅ iter-1 pass. URL detected cleanly, no click-through. | 18 | $0.72 |
| 2 | `opentable-experience-venue` | Detect `/booking/specials` + `experienceIds` at a venue with prix-fixe packages (TAO Downtown NYC, `metroId=8`). **Read-only — locate Standard Reservation button but do not click.** | ✅ iter-1 pass. URL + `experienceIds=563865,563870` captured. | 20 | $1.11 |
| 3 | `opentable-sf-casual-happy` | Full end-to-end booking at a no-CC SF venue (Surisan). Commits a real reservation. | ✅ iter-1 pass. Confirmation number returned. | 22 | $1.58 |

**Totals:** $3.41 LLM, ~6 min wall clock, 1 real reservation committed (to be cancelled manually by the run operator).

## `reference.py` re-validation — 2026-04-21 (post-`bb` CLI unification)

After unifying the Python executor's subprocess calls from a mix of `browse` + `bb` onto a single `bb` binary (`bb browse ...` is a 1:1 passthrough to the standalone `browse` CLI), both public tools were re-run end-to-end:

- **`search_opentable_reservations`** — `term=Italian, covers=2, date_time=2026-06-05T19:00, metro_id=4`. Returned 2 restaurants (Cucina Venti, Cafe Tiramisu) with 5 time slots each. Tiered button variant + hydration timing both verified.
- **`book_opentable_reservation`** — `restaurant_name=Surisan, time_label=7:30 PM, date_time=2026-05-29T19:30, party_size=2, metro_id=4`. **Real reservation committed, confirmation #17165.** `/booking/details` path, no CC hold, 15s hydration wait held.

Also caught + fixed a latent regex bug in `reference.py`'s `_SIMPLE_BTN`: the lazy `(.+?)` + optional `(?:\s+restaurant)?` tail captured only the first character of the restaurant name (producing "S"/"r" instead of "Surisan") because the regex backtracked to the shortest match. Fix: greedy `([^\n]+)` + strip `\s+restaurant$` suffix in post-processing. Caught by the re-validation run.

Confirmation #17165 is a real booking — cancelled manually after verification.

## `reference.py` benchmark run — 2026-04-22 (Lao Table demo)

Third e2e booking pass to demonstrate the typed-handoff contract alongside a successful commit:

- **First attempt:** `book Lao Table, 2026-06-26 19:30, party 2` → returned `no_availability` handoff in **48s**:
  ```json
  {"success": false, "reason": "no_availability",
   "error_reasoning": "No 7:30 PM slot visible on 'Lao Table''s card.",
   "live_view_url": "https://www.browserbase.com/sessions/..."}
  ```
  No crash, no hang, no fake confirmation — structured JSON with a live-view URL for human handoff.
- **Search probe:** `search Lao Table, 2026-06-19 19:30, party 2` → 4 slots visible (7:00, 7:15, 7:30, 7:45 PM).
- **Second attempt:** `book Lao Table, 2026-06-19 19:30, party 2` → **confirmation #44724 committed in 69s.** `/booking/details` path, no CC hold.

Two-step "search then book with retry-on-no-availability" flow completed in ~2 min total wall-clock, ~$0.006 LLM cost (caller-side only; the deterministic executor has no LLM in the browser-driving loop). Confirmation #44724 cancelled manually after verification.

## What the matrix validated

- **Recipe is correct as written.** Every iteration passed on the first try without the outer agent needing to edit `strategy.md`. The canonical `SKILL.md` captures everything the inner agent needs.
- **4 label variants + 3 URL variants covered.** Tasks exercised all three booking-flow paths. Label-variant handling was validated across the SF cuisine-search task during earlier stress testing.
- **Akamai warmup works reliably.** All three tasks applied the homepage-warmup before `/s?` navigation. Zero `Access Denied` responses.
- **Hydration timing holds at 15s.** Every task's search step loaded cards successfully with a single `bb browse wait timeout 15000`.
- **Typed handoffs fire correctly.** Tasks 1 and 2 returned structured handoff JSON matching SKILL.md's `Failure Recovery` section without false confirmations.
- **Idempotency holds.** Task 3's inner agent stopped on first sight of `confirmationNumber=` in the URL. No duplicate clicks, no reload, no re-submit.

## Known gaps

- **Interstitial paths not clicked through to confirmation.** Tasks 1 and 2 stopped at the URL-detection step. We have not — in this matrix or elsewhere — driven a full booking at a CC-hold or experience venue (by design, to avoid the extra real reservations + credit-card handling during validation). The guidance in SKILL.md for Step 6 interstitial resolution is based on URL inspection, not a completed flow.
- **Matrix size is 3.** A broader matrix (different metros, large party sizes, sold-out / no-availability paths, dynamic points-redemption venues) would give more confidence. 3 tasks at 5-iteration budget each at ~$3/task is cheap; if you'd like wider coverage, adding tasks is mechanical.
- **Single Browserbase project, single context ID.** All three tasks used one project + one pre-authed context. Behavior under multi-tenant conditions (many concurrent contexts, different proxy regions, different session configs) is unvalidated.
- **Single day of validation.** OpenTable's DOM / Akamai rules can drift. The hydration-timing bug this session is a direct example — 8s was enough when the skill was first graduated; 10–12s of XHR latency has crept in. A daily canary run would catch this earlier.

## How to reproduce

The deterministic path in this folder (`skill/reference.py`) is fully reproducible on your machine — see `GETTING_STARTED.md`.

The autobrowse matrix runs that produced this evidence are reproducible by installing the `/autobrowse` Claude Code skill and running its task definitions against `--env remote`; see the `/autobrowse` skill docs for setup.
