# Pattern library

Two tiers. **Tier A** = Anthropic's generic orchestration grammar (public). **Tier B** =
Browserbase's browser-native patterns, mined from real customers — the moat. The generator
picks patterns deliberately and names them in its summary. Patterns act at two altitudes:
**orchestration** patterns shape the emitted *code*; **within-agent** patterns shape the
*task prompt* you write into each `agent()` leaf.

Browser agents have a **4th failure mode** beyond Anthropic's three (agentic laziness,
self-preferential bias, goal drift): **silent / access failure** — "it said it did it but
didn't," a bot-wall returning a $0/stale value, a cookie that didn't persist. The browser-native
patterns exist to fight this one, and it's why `verify` must gather *fresh* evidence.

---

## Tier A — orchestration grammar (generic), with browser specialization

### classify-and-act
Generic: a classifier agent routes to different behavior by task type.
**Browser specialization — leaf-tier routing:** classify each page/source (static vs JS vs bot-walled) and route to the cheapest capable approach. Today, expressed as a *prompt steer* inside the leaf.
```js
// steer inside the agent task:
"Try a direct fetch of the page first. If it's JS-heavy or bot-walled, drive it in the browser."
```
Fights: cost, goal drift.

### fan-out-and-synthesize
Generic: split into many steps, run an agent on each, synthesize.
**Browser — parallel session fan-out:** one agent (= one cloud session) per merchant/SKU/portal, then a `compute` synthesis. The core scale pattern.
```js
const perMerchant = await forEach(merchants, (m) =>
  agent(`On ${m.site}, find <thing> and return prices`, { resultSchema: PRICES, label: m.name }));
const merged = compute("merge", () => perMerchant.filter(Boolean).flat());
```
Fights: agentic laziness (the code guarantees every merchant runs).

### adversarial verification
Generic: a separate agent verifies each output against a rubric.
**Browser — verify-after-action with FRESH evidence:** an independent agent re-opens the page / re-reads the value / confirms the action landed, using a *different* path than the producer. Never trust self-report.
```js
const checks = await verify([
  { id: "real-prices", run: () => agent(`Re-open ${url} in a fresh session and report the price the buyer pays`, { resultSchema: PRICE, cache: false })
      .then(v => Number.isFinite(v.price) && v.price === claimed) },
]);
if (checks.length !== 1 || checks.some(check => check.pass !== true)) {
  throw new Error("Price remains unverified");
}
```
Fights: self-preferential bias **and** the 4th mode (silent failure). This is the load-bearing wall.

### generate-and-filter
Generic: generate ideas, filter by rubric, dedupe.
**Browser — extract candidates → filter/dedupe in `compute`:** scrape many results, then filter by a rule (in budget, in stock, ships to ZIP) and dedupe by id.
Fights: self-preferential bias.

### tournament
Generic: N agents attempt the same task with different approaches; a judge picks.
**Browser — comparative ranking:** when ranking scraped options (cheapest, best), prefer pairwise/comparative judgment over noisy absolute scores; or run the same scrape via two approaches (fetch vs browser) and reconcile.
Fights: self-preferential bias; noisy single-pass results.

### loop-until-done
Generic: keep spawning until a stop condition.
**Browser — paginate/scroll-until-dry, retry-on-block, poll-on-schedule:** loop until no new results, retry transient bot-blocks with backoff, or re-run on a schedule.
```js
await retry(() => agent(task, { resultSchema }), 3);   // transient anti-bot
```
Fights: agentic laziness, goal drift.

---

## Tier B — browser-native patterns (no generic analog) — the moat

### auth-once-then-fan-out
Authenticate once (persist a context), then fan out many sessions that reuse it. *(Needs contexts/variables; pair with fan-out.)* Customer evidence: Clay (`persist:true → many persist:false`).

### human-in-loop handoff
For MFA / CAPTCHA / payment, hand the live session to a human (Live View), then resume. Mark the node `human_in_loop`. Evidence: Convergence (200k users).

### credential brokering
Sensitive values go in `variables` (referenced by key, never shown to the model), not in the `task`. Evidence: the Agents API `variables` mechanism; Ramp/Visa PII.

### observe-then-act (within-agent steer)
Steer the leaf to read the page (snapshot/extract) before acting, and to resolve targets once then reuse — fewer wasted steps. Evidence: Heavi ("1 observe, 98 clicks").

### verify-after-submit (within-agent steer)
Steer the leaf: after a submit/checkout step, re-open or re-read to confirm it actually took before reporting success. The single biggest silent-failure guard. Evidence: Ramp ("act said it clicked but it didn't").

### ships-to-ZIP / delivered-cost (within-agent steer)
For commerce comparisons, price isn't the item price — steer the leaf to capture shipping/tax to the buyer's ZIP (or whether it ships there at all), so `compute` can rank known comparable totals. Unknown shipping must remain unpriced, and missing taxes or fees must be disclosed. Do not label item-plus-shipping amounts as complete checkout totals.

---

## Choosing patterns (quick guide)

- Many independent sources → **fan-out-and-synthesize**.
- Comparing/ranking options → **generate-and-filter** + **comparative ranking**, rank in `compute`.
- Money / irreversible / "did it really happen" → **adversarial verification** (fresh evidence) — always.
- Unknown amount of work → **loop-until-done**.
- Bot-walled / flaky sources → **retry-on-block** + leaf-tier routing steer.
- Commerce + delivery → **ships-to-ZIP** steer so ranking is by delivered cost.
