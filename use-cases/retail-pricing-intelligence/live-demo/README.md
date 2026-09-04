# RQ1 Payment Discovery — reusable agent fleet

One named, reusable Browserbase agent per retailer, launched in parallel from the terminal.
Replaces the ad-hoc runs in `../demo/agents-runner.mjs`, where the persona and schema were
re-sent inline on every call and the runs showed up anonymous in the dashboard.

Browserbase project: **Retailer Demo** (`07b43b5d-e64a-43e7-98f6-b4b207d56b80`)

## The agents

| Retailer | Agent ID |
|---|---|
| Retailer | `d9e33948-4c84-477e-b24d-af19c3a56674` |
| Amazon | `dc091c95-25b0-4751-bba1-7076571897ed` |
| Instacart | `de95ad11-e90d-44a5-a540-66a83ca2628a` |
| Costco | `c045c5a4-db24-4bd6-b7bb-7ab61c739d18` |
| Shopify (Allbirds) | `652eae08-5cf8-4ea2-8a7c-9a907c73c04f` |

Each carries the full RQ1 `systemPrompt` (shared researcher persona + guardrails + that
retailer's specifics) and the 11-field `resultSchema`. The per-run `task` is therefore one
line — `"Run the RQ1 payment-discovery study on X and return the structured result."`

`agents/definitions.mjs` is the source of truth. `agents.json` is the generated manifest.

## Setup

```sh
cp .env.example .env    # fill in key + project id
npm install
```

## Demo commands

```sh
set -a && . ./.env && set +a     # load credentials into the shell

npm run sync:dry                 # show what would change, write nothing
npm run sync                     # create/update agents — idempotent, safe to re-run

node run-all.mjs                 # launch all 5 in parallel
node run-all.mjs retailer amazon  # launch a subset
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
- Expect occasional `FAILED` runs on bot-protected storefronts (Amazon and Instacart both
  failed on the first pass of the original study and passed on retry). Re-launch just those:
  `node run-all.mjs amazon instacart`.
