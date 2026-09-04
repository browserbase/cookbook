# Onboarding instructions for your AI coding agent

You are a coding agent helping the user evaluate this starter kit for the Browserbase dev→prod loop — a pattern for shipping robust, scalable browser-automation workflows (explore → graduate → deploy → self-heal → re-explore). The worked example in this folder automates OpenTable reservations.

## What to do

1. Read `README.md` for framing, then `LOOP.md` for the 5-step framework, then `GETTING_STARTED.md` for the hands-on walkthrough. In that order.
2. Run the read-only search demo from `GETTING_STARTED.md` Step 2 to validate the deterministic path end-to-end against live OpenTable.
3. Skim `skill/SKILL.md` + `skill/reference.py` to understand what a graduated skill looks like in code.
4. Skim `templates/task.md` to understand the intent-brief shape the user would fill out for their next flow.
5. Summarize back to the user: what this folder is, how the pattern works, whether it'd fit their use case, anything that was unclear.

## Environment expected

Before running any `reference.py` or `bb` commands, verify these are set (or ask the user):

- `BROWSERBASE_API_KEY`
- `BROWSERBASE_PROJECT_ID`
- `BROWSERBASE_CONTEXT_ID` — a pre-authed OpenTable context seeded via the `/cookie-sync` Claude Code skill

If any are missing, **ask the user** rather than guessing or using placeholder values.

## Hard guardrails

- **Do NOT run `python3 skill/reference.py book ...`** without explicit user authorization for the specific restaurant + date + time + party. That command commits a **real reservation** under the OpenTable account authed in the context. The `search` command is read-only and safe to run.
- **Do NOT modify files in this folder** unless the user explicitly asks.
- **Do NOT invent install commands, URLs, or env vars.** If something isn't documented, ask.

## Reference layout

- `README.md` — human-facing entry point
- `LOOP.md` — the 5-step dev→prod framework
- `GETTING_STARTED.md` — 3-step hands-on walkthrough
- `skill/SKILL.md` — graduated OpenTable workflow (runbook)
- `skill/references/` — per-heuristic knowledge store (venues, label variants, URL paths, timing, CC detection, T&Cs gates, etc.). Consult on-demand via SKILL.md's "When you see…" lookup table.
- `skill/reference.py` — deterministic Python executor (tool-callable)
- `skill/fallback_sketch.py` — illustrative self-heal pattern
- `templates/task.md` — intent brief for kicking off `/autobrowse` on a new site
- `templates/canary.py` — runnable drift-canary script
- `VALIDATION.md` — evidence the skill works against live OpenTable
- `BENCHMARK.md` — cost/time measurements vs. an LLM-driven baseline
