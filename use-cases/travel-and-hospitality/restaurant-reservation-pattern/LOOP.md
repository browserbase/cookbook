# The Browserbase Dev→Prod Loop

A repeatable pattern for shipping browser-automation workflows on Browserbase — explore a new site with an LLM, graduate happy paths into deterministic sequences, run them reliably in production, fall back to fresh inference on drift, and periodically re-explore when the site changes.

This folder is a reference implementation: the reservation portal booking skill under `skill/` is the output of Steps 1–2, `reference.py` is the Step-3 execution layer, `fallback_sketch.py` + `VALIDATION.md` cover Step 4, and `templates/canary.py` covers Step 5.

## The 5 steps

```
   ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
   │  1. EXPLORE      │ ──▶ │  2. GRADUATE     │ ──▶ │  3. DEPLOY       │
   │  autobrowse +    │     │  SKILL.md +      │     │  reference.py    │
   │  bb CLI + LLM    │     │  references/ +  │     │  as an agent     │
   │  converge recipe │     │  reference.py    │     │  tool            │
   └──────────────────┘     └──────────────────┘     └────────┬─────────┘
             ▲                                                │
             │                                                ▼
             │                       ┌──────────────────────────────┐
             │                       │  4. SELF-HEAL                │
             │                       │  typed failure → bounded     │
             │                       │  fresh inference → new       │
             │                       │  heuristic → references/     │
             │                       └──────────────┬───────────────┘
             │                                      │
             │              ┌───────────────────────┘
             │              ▼
   ┌─────────┴────────────────────────┐
   │  5. RE-EXPLORE                   │
   │  drift canary fails → re-run     │
   │  autobrowse from the same task   │
   └──────────────────────────────────┘
```

## Step 1 — Explore

Claude Code drives `bb browse ...` + `bb sessions ...` against a live site, attempting the end-to-end flow described in a `task.md` intent brief. The `/autobrowse` Claude Code skill iterates: an inner agent executes, an outer agent reads the trace and edits `strategy.md` with one hypothesis per iteration. The loop converges when the inner agent passes ≥2 of the last 3 runs. See `templates/task.md` for the intent-brief template.

**Run it.** Install the `/autobrowse` Claude Code skill (per its own skill docs), then from a task workspace:

```bash
/autobrowse --task <task-name> --env remote
```

**Cadence.** Once per new site (or sub-flow). This is the expensive step — the payoff is that Step 3 is cheap and deterministic.

## Step 2 — Graduate

Once `strategy.md` converges, promote it into a self-contained Claude Code skill:

- `SKILL.md` — the canonical workflow (session config, numbered steps, stop conditions, handoff reasons).
- `references/` — per-heuristic knowledge store. Each file covers one signal/pattern/venue and cites its deterministic encoding in `reference.py`. SKILL.md's "When you see… consult…" table routes from observed signals to the relevant file. New findings = drop a new file + one row in the table.
- `reference.py` (optional) — a Python executor that wraps the workflow as Anthropic-SDK-compatible tool definitions; shells out to `bb browse ...` and `bb sessions ...`.

Graduation is a hand-promotion: read the final `strategy.md`, strip experimentation scaffolding, fill in the "when to use / when not to" framing, and tighten into a skill a stranger could run. This folder's `skill/` directory is a worked example of the output shape.

**Cadence.** Once per graduated skill. Revisit when Step 5 fires.

## Step 3 — Deploy

The calling agent wraps `reference.py` (or equivalent) as a tool definition and exposes it to the model. When the agent needs to book, it calls the tool — no reasoning over DOM in the hot path. The deterministic path is fast, cheap, and predictable.

**Integration shape.** `reference.py` exports `TOOLS` (Anthropic tool schemas) and `run_tool(name, input)`. Drop into any Anthropic-SDK loop, or port the two tool handlers to the SDK of choice. Session lifecycle (`bb sessions ...`), stealth, CAPTCHA handling, residential proxies, and live-view URLs for human-in-the-loop handoffs are all Browserbase platform primitives the executor composes; the adopter owns rate-limiting, per-tenant auth routing, and orchestration between exploratory (LLM-driven) and deterministic (this tool) paths.

## Step 4 — Self-heal

On a typed failure from the deterministic path (`unknown_validation_error`, `label_not_found`, `phone_format_rejected`), the agent falls back to a bounded fresh-inference run against the current page snapshot. The model identifies what to click or fill, the executor applies it via `bb browse`, and the new heuristic lands as a new file in `references/` (plus a row in SKILL.md's "When you see…" table) so the next run handles the pattern deterministically.

Fallback is **bounded**: max N turns + max $X cost per request. Unrecoverable reasons (`auth_required`, `credit_card_required`, `captcha_or_blocked`) route straight to a human-in-the-loop handoff via the Browserbase live-view URL (`https://www.browserbase.com/sessions/<id>`) — the fallback doesn't try those.

See `skill/fallback_sketch.py` for the pattern shape.

**Caveats.** This pattern is illustrative — `fallback_sketch.py` is prose + pseudocode, not a validated end-to-end implementation. Turn + cost caps, typed-reason-to-recovery-action mapping, and the learning-append contract are adopter decisions.

## Step 5 — Re-explore

A drift canary runs a known-good query daily against live `/s?`. On repeated failure — more than N days in a row, or a critical regex no longer matches — the canary alerts, and (optionally) auto-triggers a fresh `/autobrowse` run against the original `task.md`. The new converged `strategy.md` replaces the old `SKILL.md` + `references/`.

See `templates/canary.py` for a runnable canary. Cron deployment, alert routing (PagerDuty / Slack / email), and the auto-retrigger-vs-human-approved-regen decision live in the adopter's stack.

**Cadence.** Daily. Failure should be rare; when it fires, it's a real signal.

## Known limitations of this reference implementation

Factual list of what's validated vs. what isn't:

1. **Self-heal (Step 4) is illustrative.** `skill/fallback_sketch.py` is a prose + pseudocode pattern. Fresh inference recovering a real production failure end-to-end has not been demonstrated in this reference implementation.
2. **Drift canary is a template, not a managed service.** `templates/canary.py` is a runnable example; cron deployment and alerting routing live in the adopter's stack.
3. **Multi-tenant context orchestration is out of scope.** Everything here assumes one `BROWSERBASE_CONTEXT_ID` per run. A canonical pattern for one-context-per-end-user at scale (onboarding UX + lifecycle management + refresh on expiry) is a separate design exercise.
4. **Interstitial booking paths are URL-validated, not fully click-tested.** `/booking/seating-options` (credit-card-hold venues) and `/booking/specials` (experience venues) are detected but not driven all the way to a committed reservation in this reference. Standard `/booking/details` is validated end-to-end.

See `VALIDATION.md` for the matrix results and `BENCHMARK.md` for the cost/time comparison against an LLM-driven baseline.
