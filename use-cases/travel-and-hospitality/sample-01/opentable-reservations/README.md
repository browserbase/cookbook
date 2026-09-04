# OpenTable automation — starter kit from Browserbase

This folder is your starting kit for adopting a repeatable pattern Browserbase has developed for shipping robust, scalable browser-automation workflows: **explore a new site once, graduate the happy path into a deterministic recipe, deploy as an agent tool, self-heal on drift, re-explore when things change.** OpenTable booking is the worked example — the same pattern applies to any booking, form, checkout, or multi-step flow on any site.

## Using an AI coding agent?

Open this folder in Claude Code and say "walk me through this" — [`CLAUDE.md`](./CLAUDE.md) auto-loads and primes the agent with the layout, what to read, what to run, and the guardrails that prevent it from committing a real reservation. For coding agents that don't auto-load `CLAUDE.md` (Cursor, Windsurf, ChatGPT Code, etc.), paste its contents as your first message.

## Start here

Open [`GETTING_STARTED.md`](./GETTING_STARTED.md) — it walks you through the 3-step onboarding:

1. Read [`LOOP.md`](./LOOP.md) (5 min) — the 5-step dev→prod framework.
2. Run the OpenTable example yourself (~15 min) — see the deterministic executor commit a real reservation.
3. Fill out [`templates/task.md`](./templates/task.md) for your next flow and run `/autobrowse` against a new site yourself.

## Why you might care

If you've been feeling any of these on your current Stagehand-based flows, this kit offers an alternative pattern:

- **LLM reasoning over selectors on every run.** The model rediscovers each site's structure (button variants, URL paths, hydration timing, bot-protection behavior) per request. Works on the happy path; gets fragile on the long tail.
- **No cumulative site knowledge.** Every run starts cold. Gotchas learned in one booking don't persist to the next.
- **Errors collapse into a single string.** Your agent can't branch on `auth_required` vs `no_availability` vs `credit_card_required`, can't self-heal, can't route cleanly to a human.
- **Per-site imperative scripts don't scale.** N sites × M flows = N×M brittle hand-rolled scripts, each rediscovered by the LLM at runtime.

The pattern in this kit replaces that with: **one `/autobrowse` run per flow, deterministic replay forever after.**

## What's in this folder

| File | Purpose |
|---|---|
| `README.md` (this) | Framing + entry point |
| `GETTING_STARTED.md` | 3-step onboarding — read this next |
| `LOOP.md` | The 5-step dev→prod framework |
| `VALIDATION.md` | Evidence that the OpenTable skill + `reference.py` execute correctly against live OpenTable |
| `BENCHMARK.md` | Measured cost + time comparison: skill vs. LLM-driven baseline |
| `skill/SKILL.md` | Graduated workflow — 8-step recipe, 4 button-label variants, 3 booking-URL variants, 6 typed handoffs |
| `skill/references/` | Per-heuristic knowledge store (venues, label variants, URL paths, timing, CC detection, T&Cs gates, etc.) |
| `skill/reference.py` | Deterministic Python executor — wraps the workflow as Anthropic-SDK-compatible tools; ~$0.001/run, no LLM in the browsing loop |
| `skill/fallback_sketch.py` | Illustrative self-heal pattern for Step 4 of the loop |
| `templates/task.md` | Intent-brief template for kicking off `/autobrowse` on a new site |
| `templates/canary.py` | Runnable drift-canary script for Step 5 |

## Prereqs

```bash
npm install -g @browserbasehq/cli   # `bb` — one binary; `bb browse` is the browser-automation subcommand
```

You'll also need:
- `BROWSERBASE_API_KEY`
- `BROWSERBASE_PROJECT_ID`
- `BROWSERBASE_CONTEXT_ID` — a pre-authed OpenTable context seeded via the `/cookie-sync` Claude Code skill (install per its own skill docs)

## What to do next

Follow `GETTING_STARTED.md`. Questions or feedback on this reference implementation are welcome via your existing Browserbase channels.
