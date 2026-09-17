# RQ1 Payment Discovery — reusable agent fleet

One named, reusable Browserbase agent per retailer, launched in parallel from the terminal.
Replaces the ad-hoc runs in `../demo/agents-runner.mjs`, where the persona and schema were
re-sent inline on every call and the runs showed up anonymous in the dashboard.

Set credentials locally; no secrets are committed.

## The agents

| Retailer | Agent ID |
|---|---|
| Retailer | set locally |
| Marketplace A | set locally |
| Marketplace B | set locally |
| Merchant C | set locally |
| Commerce Platform D (Merchant D) | set locally |

Each carries the full RQ1 `systemPrompt` (shared researcher persona + guardrails + that
retailer's specifics) and the 11-field `resultSchema`. The per-run `task` is therefore one
line — `"Run the RQ1 payment-discovery study on X and return the structured result."`

`agents/definitions.mjs` is the source of truth. `agents.json` is the generated manifest.

## Setup

```sh
cp .env.example .env    # fill in BROWSERBASE_API_KEY
npm install
```

## Demo commands

```sh
set -a && . ./.env && set +a     # load credentials into the shell

npm run sync:dry                 # show what would change, write nothing
npm run sync                     # create/update agents — idempotent, safe to re-run

node run-all.mjs                 # launch all 5 in parallel
node run-all.mjs retailer marketplace_a  # launch a subset
```

`run-all.mjs` prints each session's dashboard URL as soon as it resolves, then polls every
15s until every run is terminal and writes `results.json`. Ctrl-C only stops the polling —
the runs continue server-side and stay visible in the dashboard.

## Notes

- **Idempotency**: the API echoes `resultSchema` back with keys reordered, so drift detection
  compares canonicalised JSON. Without that, every sync issued five pointless writes.
- **`sessionId` is not on the create response.** It appears a beat later, so the script polls
  fast up front purely to surface the links.
- Agents are **account-scoped**, not project-scoped — there is no `projectId` on
  `agents.create` or `runs.create`. The project scopes the sessions, not the agent list.
- Expect occasional `FAILED` runs on bot-protected storefronts (Marketplace A and Marketplace B both
  failed on the first pass of the original study and passed on retry). Re-launch just those:
  `node run-all.mjs marketplace_a marketplace_b`.
