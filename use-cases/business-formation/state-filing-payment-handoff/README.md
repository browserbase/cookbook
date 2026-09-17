# example-demo — Explorer Agent on bizfile.sos.ca.gov

End-to-end test of the `autobrowse` + `autobrowse export --target playwright` loop on a real California state-agency portal (bizfile / Secretary of State).

**Demo use case**: California LLC formation via Form LLC-1. The payment-handoff path walks the 11-step wizard, signs Step 9, clicks Step 11's **File Online** button to open the payment screen, fills the credit-card form, and stops before the final payment-submit button. The filing and charge are reserved for a human.

Use this as an implementation reference for state-portal automation, persistent Browserbase contexts, live human oversight, and deterministic Playwright exports from an autobrowse exploration loop.

## Architecture

```
1. bootstrap-context.sh
     └─→ Browserbase context with bizfile cookies (one-time, ~3 min)

2. autobrowse evaluate.mjs --task bizfile-ca-llc --env remote
     │   BROWSERBASE_CONTEXT_ID=<id>  (transparently injects --connect)
     └─→ traces/bizfile-ca-llc/run-NNN/{trace.json, summary.md}
         Iterate strategy.md until passing.

3. autobrowse export.mjs --task bizfile-ca-llc --target playwright
     └─→ tasks/bizfile-ca-llc/playwright/run.ts
         Connects to a fresh BB session bound to the same context.
```

## Prerequisites

- `bb` CLI (`bb --version` ≥ 0.5.7)
- `browse` CLI (`browse --version` ≥ 53.1.1)
- Node 18+
- `jq` (for the bootstrap script)
- A bizfile account with creds in `.env`
- Browserbase + Anthropic API keys

## One-time setup

```bash
cd use-cases/business-formation/state-filing-payment-handoff
cp .env.example .env
# Edit .env — fill in ANTHROPIC_API_KEY, BROWSERBASE_API_KEY,
# BIZFILE_USER, BIZFILE_PASS, and the LLC_* params.
#
# Leave BIZFILE_ALLOW_PAYMENT_HANDOFF=false during setup and code checks.

./bootstrap-context.sh
# Opens a Browserbase live-view URL. In that browser:
#   - Go to https://bizfileonline.sos.ca.gov/
#   - Sign in with BIZFILE_USER / BIZFILE_PASS
#   - Confirm you reach the signed-in dashboard
#   - Come back to the terminal and press Enter
# .env now has BROWSERBASE_CONTEXT_ID=<id>
```

## Run the explorer

```bash
# Load env
set -o allexport; source .env; set +o allexport

# One iteration
node ~/Desktop/skills/skills/autobrowse/scripts/evaluate.mjs \
  --task bizfile-ca-llc \
  --workspace ./autobrowse \
  --env remote

# Tail the trace
cat autobrowse/traces/bizfile-ca-llc/latest/summary.md
```

Read the summary, identify the failure turn (if any), edit `autobrowse/tasks/bizfile-ca-llc/strategy.md` with one targeted heuristic, re-run. Typical convergence: 3–6 iterations.

A passing run ends with `{ "success": true, "stopped_at_step": "File Document or Send for Signatures (Step 11 of 11)", ... }`.

## Export to deterministic Playwright

```bash
node ~/Desktop/skills/skills/autobrowse/scripts/export.mjs \
  --task bizfile-ca-llc \
  --workspace ./autobrowse \
  --target playwright
```

This writes `autobrowse/tasks/bizfile-ca-llc/playwright/`:

- `bizfile-ca-llc.ts` — runnable Playwright script
- `selectors.cache.json` — resolved locators + fallbacks (used by future self-healing)
- `package.json` + `tsconfig.json` — scaffold

The export `--no-verify` flag is useful for inspection-only runs.

## Run the emitted script

```bash
cd autobrowse/tasks/bizfile-ca-llc/playwright
npm ci
npm test

# Same BROWSERBASE_CONTEXT_ID — attaches to your pre-authed context
BIZFILE_ALLOW_PAYMENT_HANDOFF=true \
BROWSERBASE_CONTEXT_ID=$(grep BROWSERBASE_CONTEXT_ID ../../../../.env | cut -d= -f2) \
BROWSERBASE_API_KEY=$(grep BROWSERBASE_API_KEY ../../../../.env | cut -d= -f2) \
npx tsx bizfile-ca-llc.ts
```

## Critical guardrails

The payment-handoff path is disabled unless `BIZFILE_ALLOW_PAYMENT_HANDOFF=true` is set in the environment. That path signs on Step 9, opens the post-Step-11 payment form, fills card fields, and stops before the final payment-submit button. The single click that legally files the LLC and authorizes the charge must come from a human.

The agent prompt and Playwright script both forbid clicking any payment-screen button whose label looks like a charge or submission action, including "Submit Payment", "Pay", "File", "Complete Order", or "Confirm Payment".

**Defense in depth, manual layer**: the Browserbase live-view URL is in the `bb sessions create` output of every iteration. Watch the first run live. If anything looks wrong, Ctrl+C — the trap in `evaluate.mjs` releases the session cleanly.

## Files in this repo

| Path | Purpose |
|---|---|
| `.env.example` | Template for `.env` (gitignored) |
| `bootstrap-context.sh` | One-time interactive login → persisted BB context |
| `autobrowse/tasks/bizfile-ca-llc/task.md` | The agent's brief (inputs, workflow, guardrails, output schema) |
| `autobrowse/tasks/bizfile-ca-llc/strategy.md` | Grows across iterations — heuristics the agent learns |
| `autobrowse/traces/bizfile-ca-llc/run-NNN/` | Per-run trace + screenshots + summary |
| `autobrowse/tasks/bizfile-ca-llc/playwright/` | Final emitted script (after export) |

## Troubleshooting

**"auth expired" in the first iteration**: re-run `./bootstrap-context.sh` to refresh the context. Bizfile sessions probably last 30–60 minutes.

**Agent loops on the same screen**: the trace's screenshots are in `traces/<run>/screenshots/`. Read the trace + screenshot together to find where it's stuck, add a heuristic to `strategy.md` (e.g., "after clicking Continue on the address screen, wait 2s before snapshot — the next-step button takes time to render").

**CAPTCHA wall**: `--verified` + `--solve-captchas` is already on. If it still walls, bizfile may have stricter detection — try a fresh context, or run with the live-view open and let the human nudge.
