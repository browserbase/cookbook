# Parallel KYB Verification — Reference Implementation

A reference implementation showing how to run multiple Know-Your-Business (KYB)
checks concurrently against independent public registries using
[Stagehand](https://stagehand.dev) and [Browserbase](https://browserbase.com).

This repo runs three checks in parallel against a real legal entity
(**ANKER NORTH AMERICA, LLC**, the US legal entity behind Anker Innovations) and
returns a structured demo verdict. These limited observations do not establish comprehensive merchant verification or sanctions clearance.

| Check | Source | Verifies |
|---|---|---|
| Legal entity | Delaware Division of Corporations | Entity is on record (file number, active name) |
| Sanctions | OFAC name search | Displayed matches for the entered name under the page's current search filters |
| Brand ownership | USPTO trademark search | Brand has live US trademarks and is registered to the expected owner |

Because the three checks run as three independent browser sessions in parallel,
total wall-clock time is bounded by the slowest single check — not the sum.
Adding a fourth source (e.g. California SoS, EU Sanctions List, IRS EIN match)
is additive in code only, not in latency.

## Quick start

```bash
pnpm install

# Create .env
cat > .env <<'EOF'
BROWSERBASE_API_KEY=bb_live_...
BROWSERBASE_PROJECT_ID=<from https://www.browserbase.com/settings>
EOF

# CLI mode — prints live-view URLs + final JSON report
pnpm start

# Web UI mode — http://localhost:3000, with a Run button and embedded live views
pnpm dev
```

No LLM provider key is required: `act` and `extract` calls go through Browserbase's
managed model gateway, which handles model auth on the server.

## How it works

Each check is an isolated `Stagehand` instance bound to its own Browserbase
session. The three instances are fanned out with `Promise.all`, so they run
concurrently and use three distinct browser fingerprints + IPs.

Key design choices in `kyb-parallel.ts`:

- **Stagehand API mode** (`disableAPI: false`, the default). All `act` / `extract`
  calls go through Browserbase's Stagehand API. The server handles model auth,
  routes to the requested provider, and caches resolved actions server-side so
  subsequent runs skip LLM round-trips.
- **Residential proxies** (`proxies: true`) and **verified browser mode**
  (`browserSettings.verified: true`) on every session — required to avoid
  bot-detection blocks on the sanctions and trademark sites.
- **`act` + `extract` pattern.** Each check is expressed as a short sequence of
  natural-language `act()` calls (e.g. "type %name% into the search field",
  "click the search button") followed by a Zod-typed `extract()` that returns
  structured data. No CSS selectors, no regexes over `document.body.innerText`.
- **Deterministic post-submit waits.** A fixed `setTimeout` after each submit
  guarantees the results page has rendered before `extract()` reads it. This is
  more reliable across registries than `waitForLoadState('networkidle')`.

The final report is a plain JSON object:

```json
{
  "merchant": { "legalName": "ANKER NORTH AMERICA, LLC", ... },
  "verdict": "PASS",
  "wallClockSeconds": 12.4,
  "checks": {
    "entity":    { "check": "delaware_sos",   "found": true, "fileNumber": "5772050", ..., "pass": true },
    "sanctions": { "check": "ofac_sdn",       "matchCount": 0, "matches": [], "pass": true },
    "trademark": { "check": "uspto_trademark","liveCount": 47, "topOwners": [ ... ], "pass": true }
  }
}
```

## Repository layout

```
kyb-parallel.ts   # Three check functions + runKyb() library export + CLI entry
server.ts         # Minimal Node http server: GET / serves UI, GET /run streams SSE
package.json
tsconfig.json
.env.example
```

`kyb-parallel.ts` exports `runKyb(onEvent?)` so the same logic powers both the
CLI and the web UI. `onEvent` is an optional callback that receives streaming
events (`session_started`, `check_completed`, `report`, `error`) — useful if you
want to drive a different front-end or wire the checks into a queue / workflow.

## Adapting this to other checks

The pattern for each check is:

```ts
async function myCheck(stagehand: Stagehand) {
  const page = stagehand.context.pages()[0] as any;
  await page.goto('https://your-registry.example/search');

  await stagehand.act('type %query% into the search field', {
    variables: { query: 'the value' },
  });
  await stagehand.act('click the Submit button');
  await new Promise((r) => setTimeout(r, 5000)); // post-submit render wait

  return await stagehand.extract(
    'Describe what you want extracted from the results page.',
    z.object({
      /* your Zod schema here */
    }),
  );
}
```

Then add it to the `Promise.all` in `runKyb()` and the iframe grid in `server.ts`.
The concurrency story holds — each additional check is its own session, its own
IP, and its own concurrent slot on your Browserbase plan.

## Useful documentation

### Browserbase
- [Browserbase docs](https://docs.browserbase.com)
- [Sessions API](https://docs.browserbase.com/features/sessions)
- [Proxies (residential IPs)](https://docs.browserbase.com/features/stealth-mode/proxies)
- [Verified browser mode](https://docs.browserbase.com/features/stealth-mode/verified-browser)
- [Captcha solving](https://docs.browserbase.com/features/stealth-mode/captcha-solving)
- [Advanced stealth](https://docs.browserbase.com/features/stealth-mode/advanced-stealth)
- [Browserbase dashboard](https://www.browserbase.com)

### Stagehand
- [Stagehand docs](https://docs.stagehand.dev)
- [Configuration](https://docs.stagehand.dev/v3/configuration) — constructor options, `env`, `disableAPI`, `serverCache`
- [Models](https://docs.stagehand.dev/v3/configuration/models) — model strings and gateway behavior
- [`act()`](https://docs.stagehand.dev/v3/reference/act) — atomic actions, `variables` substitution, `press`
- [`extract()`](https://docs.stagehand.dev/v3/reference/extract) — Zod-typed structured extraction
- [`observe()`](https://docs.stagehand.dev/v3/reference/observe) — find elements before acting
- [`agent()`](https://docs.stagehand.dev/v3/reference/agent) — autonomous multi-step execution
- [Caching](https://docs.stagehand.dev/v3/guides/caching)

### Registries used in this example
- [Delaware Division of Corporations](https://icis.corp.delaware.gov/Ecorp/EntitySearch/NameSearch.aspx)
- [OFAC SDN search](https://sanctionssearch.ofac.treas.gov/)
- [USPTO trademark search](https://tmsearch.uspto.gov/search/search-information)

## Troubleshooting

- **`API key expired` mid-run.** Stagehand auto-loads local model provider env
  vars (`GOOGLE_API_KEY`, `OPENAI_API_KEY`, etc.) and forwards them to the
  gateway, overriding the managed key. The script clears these at startup to
  keep the gateway path active; if you re-introduce a stale key in `.env` it
  will override that. Renew the key or keep the relevant entry in the `delete`
  loop at the top of `kyb-parallel.ts`.
- **Checks return empty / `FAIL` despite the data being visible in the live
  view.** The post-submit `setTimeout` is too short for that registry. Bump
  the delay in the corresponding check function.
- **Blank iframes in the web UI.** Corporate network policies or browser
  extensions may be stripping iframes. Try an incognito window or open the
  live-view URLs directly.
- **Session-create quota errors.** Verified browser mode + residential proxies
  require a Browserbase plan that allows both, plus enough concurrent slots
  for the number of checks you're running in parallel. Check your project
  settings at https://www.browserbase.com/settings.

## License

Provided as a reference implementation. Adapt freely.

## Screening evidence and unknown outcomes

The OFAC check requires both Stagehand actions to report success and verifies that a visible input contains the intended name. It arms a DOM observer before submission and waits for a results-banner update (or a new document) and a visible `Lookup Results: N Found` count. A stale banner, wrong input, timeout, or failed extraction returns `status: "unknown"`, `pass: null`, and a reason.

The extracted count must be a nonnegative integer equal to both the displayed count and the number of nonempty extracted names. Contradictory or partial results remain unknown. Consistent zero results produce `status: "no_matches"`; consistent positive results produce `status: "matches"`. These describe this demo query only. They do not prove an entity is absent from every sanctions list or resolve the identity of a matched name.

An unknown screening check makes the aggregate verdict `UNKNOWN`; the UI retains that distinction instead of labeling it as a match or clearance. Tests execute the actual check, aggregator and UI functions with synthetic responses. Local Chrome fixtures verify result-update detection, rejection of stale/unrelated updates, input matching and observer cleanup. Run `node --test tests/ofac.test.mjs` after installing the recipe dependencies. No live screening result or real merchant verification is established by these tests.
