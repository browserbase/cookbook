# Getting started — 3 steps

A ~30-minute walkthrough to see the pattern working end-to-end against live reservation portal, then kick off the first flow for your own use case.

## Step 1 — Read `LOOP.md` (5 min)

Open [`LOOP.md`](./LOOP.md). It lays out the 5-step dev→prod framework:

1. **Explore** — `/autobrowse` + `bb` CLI converge a working recipe on a new site.
2. **Graduate** — recipe promotes to `SKILL.md` (runbook) + `references/` (per-heuristic memory) + `reference.py` (deterministic executor).
3. **Deploy** — your agent calls `reference.py` as a tool.
4. **Self-heal** — on typed failures, bounded LLM fallback reads `SKILL.md` + page snapshot; new heuristics land as files in `references/`.
5. **Re-explore** — a drift canary triggers a fresh `/autobrowse` run when the site changes.

Come back here when you've skimmed it.

## Step 2 — Run the reservation portal example yourself (~15 min)

This commits a **real reservation** under whichever reservation portal account is authed in your Browserbase context. Use a test account.

### Setup

```bash
# CLI
npm install -g @browserbasehq/cli

# Env
export BROWSERBASE_API_KEY=...
export BROWSERBASE_CONTEXT_ID=...   # seeded via the /cookie-sync Claude Code skill
```

### Try it (read-only first)

```bash
cd skill/
python3 reference.py search '{"term":"Italian","covers":2,"date_time":"2026-06-26T19:00","metro_id":4}'
```

Expect: JSON output with a handful of restaurants + available time slots, in ~40-75 seconds. This validates session creation, Akamai warmup, hydration timing, and button-label parsing are all working.

### Then commit a real booking

Pick a test venue + date that's open. Example (replace inputs as needed):

```bash
python3 reference.py book '{"restaurant_name":"<venue>","time_label":"7:30 PM","date_time":"<YYYY-MM-DDTHH:MM>","party_size":2,"metro_id":4}'
```

Expect: JSON with `success: true` and a `confirmation_number` + `cancel_url`, in ~60-90 seconds. **Cancel the reservation afterwards.**

If the venue requires a credit-card hold or has no availability, you'll get a **typed handoff** instead — `reason: "credit_card_required"` or `reason: "no_availability"` — with a `live_view_url` for human-in-the-loop recovery. That's the contract your agent can branch on.

### What just happened

A Python script with **no LLM in the browsing loop** drove a full end-to-end reservation via `bb browse` subprocess calls. The LLM cost was just the single tool-use decision in the calling agent — the browser execution itself is ~$0 LLM.

See [`BENCHMARK.md`](./BENCHMARK.md) for the cost + time comparison vs. an LLM-driven baseline.

## Step 3 — Fill out `templates/task.md` for your next flow

Pick a flow you want to automate next — different restaurant booking site (Resy, Tock), a different reservation portal flow (cancel/modify), or something entirely different (Ticketmaster, DMV, insurance form, whatever).

Open [`templates/task.md`](./templates/task.md) and fill it in. It's intentionally short — just your intent, not a step-by-step script:

- **Goal** (one sentence)
- **Runtime inputs** (what your agent will pass at runtime)
- **Auth** (if needed — point at a pre-authed context)
- **Success signal** (what "done" looks like in plain terms)
- **Failure signals** (recoverable modes for typed handoffs)
- **Expected output JSON**
- **Budget** (turn + iteration caps)

Once the `task.md` is filled out, install the `/autobrowse` Claude Code skill (per its own skill docs) and run it against your new site. Typical convergence is 3-5 iterations at ~$0.50-2 each (~$5-10 total to converge a new flow). Once converged, graduate the resulting `strategy.md` into a `SKILL.md` + `reference.py` using the `skill/` directory in this folder as the template shape.

## Questions?

Questions or feedback on this reference implementation are welcome via your existing Browserbase channels.
