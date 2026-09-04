# sample_org-ein-demo — Autobrowse Explorer for IRS EIN Application

Demo scaffold for **Sample Organization Use case 2: IRS EIN Application** from the POC Use Case Tracker in `/sample_org`.

An Autobrowse exploratory agent runs first, learns the IRS EIN Online Assistant flow through trace iterations, then a deterministic Playwright script replays the validated path.

## Demo Use Case

Complete the IRS EIN Online Assistant for a single-member LLC using customer-style inputs, then stop at the final **Review & Submit** boundary.

Start URL:

```text
https://sa.www4.irs.gov/applyein/legalStructure
```

## Critical Guardrail

The IRS EIN Online Assistant can issue a real EIN. This demo must never submit the application.

Both the Autobrowse task and the Playwright script stop when the progress tracker reaches **Review & Submit**. Do not click any final-submission control such as `Submit`, `Submit Application`, `Get EIN`, `Assign EIN`, `Submit EIN Request`, or any equivalent.

## Files

| Path | Purpose |
|---|---|
| `.example.env` | Local environment template for API keys and EIN inputs |
| `autobrowse/tasks/irs-ein-llc/task.md` | Autobrowse task brief, input data, stop rules, and output schema |
| `autobrowse/tasks/irs-ein-llc/strategy.md` | Learned navigation strategy updated after each Autobrowse run |
| `autobrowse/traces/irs-ein-llc/` | Created by Autobrowse runs |
| `autobrowse/tasks/irs-ein-llc/playwright/` | Deterministic replay script + project scaffold |

## Prerequisites

- Node 18+
- `browse` CLI
- `bb` CLI
- Browserbase API key and project ID
- Anthropic API key for the Autobrowse inner agent

## Setup

```bash
cd business-formation/sample-01/irs-ein
cp .example.env .env
```

Edit `.env` and fill in:

- `ANTHROPIC_API_KEY`
- `BROWSERBASE_API_KEY`
- `BROWSERBASE_PROJECT_ID`
- `EIN_RESPONSIBLE_SSN`, `EIN_RESPONSIBLE_FIRST_NAME`, `EIN_RESPONSIBLE_LAST_NAME` — the IRS runs a real-time TIN/name match on these. Mock values will be rejected at the Identity step; supply real, IRS-registered values to advance to Addresses.

Other `EIN_*` business inputs have working defaults in `.example.env`. The IRS flow does not require login, so no persisted Browserbase context bootstrap is needed.

## Run Autobrowse

`task.md` and `strategy.md` contain `$EIN_*` placeholders. The block below substitutes them from `.env` into a temp workspace before invoking `evaluate.mjs`, so real PII never lands in the repo files. Trace output is symlinked back to the real `autobrowse/traces/irs-ein-llc/`.

```bash
cd business-formation/sample-01/irs-ein
(
  set -o allexport; source .env; set +o allexport
  export AUTOBROWSE_MAX_TURNS=80

  WS=$(mktemp -d -t autobrowse-ein-XXXXXX)
  mkdir -p "$WS/tasks/irs-ein-llc" "$WS/traces"
  ln -s "$(pwd)/autobrowse/traces/irs-ein-llc" "$WS/traces/irs-ein-llc"
  for f in task.md strategy.md; do
    node -e '
      const fs = require("fs");
      const [, inP, outP] = process.argv;
      const text = fs.readFileSync(inP, "utf8")
        .replace(/\$\{?(EIN_[A-Z0-9_]+)\}?/g, (m, n) => process.env[n] ?? m);
      fs.writeFileSync(outP, text);
    ' "autobrowse/tasks/irs-ein-llc/$f" "$WS/tasks/irs-ein-llc/$f"
  done
  if grep -RE '\$EIN_[A-Z_]+' "$WS/tasks/irs-ein-llc/" >/dev/null; then
    echo "ERROR: unsubstituted \$EIN_* remain — check .env" >&2
    exit 1
  fi
  trap "browse stop >/dev/null 2>&1 || true; rm -rf $WS" EXIT

  node ~/.agents/skills/autobrowse/scripts/evaluate.mjs \
    --task irs-ein-llc \
    --workspace "$WS" \
    --env remote
)
```

After each run, inspect the summary:

```bash
cat autobrowse/traces/irs-ein-llc/latest/summary.md
```

If the agent gets stuck or stops early, update `autobrowse/tasks/irs-ein-llc/strategy.md` with one concrete learned heuristic and rerun.

## Run the deterministic Playwright script

Once Autobrowse has reached Review & Submit successfully, replay the captured path with the Playwright script:

```bash
cd autobrowse/tasks/irs-ein-llc/playwright
npm ci
npm test

# Loads EIN_* and BROWSERBASE_* from sample_org-ein-demo/.env via dotenv.
ln -sf ../../../../.env .env
npm start
```

The script reads all PII (SSN, name, address, phone) from `process.env.EIN_*` at runtime — no real identifiers are committed in the script. It stops at the Review & Submit page, captures `review-submit.png`, and prints a success JSON. It never clicks the final submission button.

## IRS Availability

The IRS EIN Online Assistant has operating hours (Mon–Fri, daytime ET) and short session timeouts (~15 min). Run during the published hours and expect to retry if the session expires mid-flow.
