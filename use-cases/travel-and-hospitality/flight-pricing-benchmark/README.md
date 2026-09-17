# Travel portal — Flight Pricing Benchmark Demo

This example shops selected airline and travel sources for a common departure date and compares usable nonstop fare observations. It supports local browsers or Browserbase sessions, with optional authenticated Travel portal shopping.

Sources launch concurrently, but navigation and extraction finish at different times. The report records those times and cannot establish synchronized prices, equivalent fare restrictions, or reusable authentication across future sessions. A failed or incomplete source contributes no comparison price.

## What it does

1. Starts the selected sources concurrently in the configured local or Browserbase mode.
2. Each session navigates to the source's flight search and runs the same
   route + date.
3. Stagehand's AI confirms one-way search state, then extracts the cheapest
   one-way nonstop economy fare from each site.
4. Compares all prices side-by-side and produces a benchmark report.

### Sources (all real websites — no mocks)

| Source           | URL                                | Status                                  |
| ---------------- | ---------------------------------- | --------------------------------------- |
| Google Flights   | google.com/travel/flights          | ✅ Working — confirms one-way + extracts cheapest nonstop |
| Kayak            | kayak.com                          | ✅ Working — confirms one-way + extracts cheapest nonstop |
| **Travel Portal** (auth) | app.travel.example (login required)     | Uses Browserbase Context + Stagehand one-way search flow |

## Quick Start

```bash
cd travel-and-hospitality/flight-pricing-benchmark
npm install

cp .env.example .env
# Fill in:
# BROWSERBASE_API_KEY
#   ANTHROPIC_API_KEY (or MODEL_API_KEY) for Stagehand primitives
#   OPENAI_API_KEY for the outer browser agent
#   TRAVEL_PORTAL_EMAIL, TRAVEL_PORTAL_PASSWORD   (optional - skip Travel portal with --no-travel_portal)

# One-time Travel portal context setup for magic-link/MFA accounts:
npm run demo -- --setup-travel-portal-context
# Add the printed TRAVEL_PORTAL_CONTEXT_ID to .env.

# Single route, all sources:
npx tsx index.ts --single

# Travel portal only, using the saved Browserbase context:
npm run demo:travel_portal

# All 5 routes, all sources (concurrent — 15 sessions):
npx tsx index.ts

# Subset of sources (skip Travel Portal, just shop external):
npx tsx index.ts --single --no-travel portal --only=GF,KY
```

## Sample run output format

```
Mode:       ☁️  Browserbase Cloud (Verified + proxies)
External:   Google Flights, Kayak
Travel Portal:      ✓ logging in with credentials (variables)
Routes:     1 (single)
Sessions:   3 total

[10:16:26 PM] 🚀 Concurrent  Launching 3 browsers simultaneously
[10:16:53 PM] Google Flights  Cheapest one-way nonstop: $317 (JetBlue, 27.2s)
[10:17:08 PM] Kayak           Cheapest one-way nonstop: $319 (JetBlue, 41.7s)
[10:17:30 PM] Travel portal           Cheapest one-way nonstop: — (login OK, extraction empty)
```

## Architecture

```
travel_portal/
├── index.ts          # Main concurrent runner
├── package.json
├── .env.example
└── README.md
```

### Key technical bits

- **`Promise.all`** runs all sources concurrently — this is the headline
  Browserbase capability for this environment.
- **One-way normalization** — Google Flights, Kayak, and Travel portal are all forced
  or confirmed into one-way search state before extraction. Extraction ignores
  round-trip totals and returns null only when the page explicitly remains in
  round-trip mode.
- **`verified: true` + `proxies: true`** — required for airline + OTA
  sites that have aggressive bot detection.
- **`enableCaching: false`** — pricing data must be fresh every run.
- **Stagehand `extract` with Zod schema** — structured price extraction with
  no brittle CSS selectors.
- **Stagehand `variables`** for the Travel portal login — the password is
  substituted at the browser layer and **never sent to the LLM**:

  ```ts
  await page.act({
    action: "Type %password% into the password field",
    variables: { password: process.env.TRAVEL_PORTAL_PASSWORD! },
  });
  ```
- **Browserbase Contexts for Travel portal auth** — `--setup-travel-portal-context` opens a
  Browserbase Live View session so MFA or email-link login can be completed
  once, then reused by benchmark runs with `TRAVEL_PORTAL_CONTEXT_ID`.
- **Inline Stagehand primitives** — Travel portal login prompts live inside `page.act`,
  the flight search form is handled by `stagehand.agent().execute(...)`, and
  extraction lives inside `page.extract`, so the demo script is easy to read on
  a shared screen.
- **Authentication evidence** — login readiness requires the exact Travel portal app origin,
  visible account controls and travel workspace controls, with no visible sign-in
  controls or challenge text. URL/body length alone never establishes login.
- **Travel portal home launcher handling** — the flight-search agent clicks the
  single home-page "Where to?" / Location field when needed, then works inside
  the expanded "Book a flight" form.
- **Scoped Stagehand agent** — after auth, the agent opens the flight search
  form, submits the route, and explicitly stops before fare selection or
  purchase.
- **Autobrowse starting point** — `autobrowse/tasks/travel-portal/` captures the
  trace task and current strategy for the next `/autobrowse` loop.

## Browserbase capabilities showcased

- **Concurrency** — 4+ browsers running at once. Scales to 2,000+ concurrent.
- **Verified + Proxies** — airline sites have aggressive bot detection; Browserbase bypasses it.
- **Session Recording** — every price check is recorded. Compliance-ready audit trail.
- **AI Adaptability** — no CSS selectors to maintain; Stagehand reads pages like a human.
- **Timed fare observations** — each completed extraction records a UTC timestamp; concurrent starts do not synchronize prices.
- **PII protection** — `variables` keep credentials out of the LLM context window.

## Known issues / next steps

- [ ] **Travel portal extraction depends on account state** — if Travel portal asks for MFA, email-link verification, or company-specific prompts, run `npm run demo -- --setup-travel-portal-context` and save the printed `TRAVEL_PORTAL_CONTEXT_ID`. The runtime path now detects those blockers instead of continuing blindly.
- [ ] **Add Delta and American** — currently dropped because they need form-fill (no usable URL params). Re-add using the Stagehand `agent` for the autonomous form flow.
- [ ] **Add Expedia** — additional OTA source.
- [ ] **Production hardening** — store extracted prices in a DB, schedule hourly runs, alert when Travel portal is >5% pricier on any route.

## Routes covered

- SFO → JFK
- SFO → LAX
- SFO → ORD (Chicago)
- LAX → DCA (Washington DC)
- SEA → JFK
- *Easy to extend to top-20 routes per country.*

## Adjacent use cases (same stack)

The same Browserbase + Stagehand pattern solves several other Travel portal pains:

| Use Case             | Description                                                          | Browserbase Feature           |
| -------------------- | -------------------------------------------------------------------- | ----------------------------- |
| **Pricing Benchmark** (this demo) | Shop airlines concurrently, compare vs Travel portal          | Concurrent browsers, Verified  |
| **Waiver Scraping**  | Monitor airline websites for travel waivers / advisories             | Scheduled automation, extract |
| **Agent Surveillance** | Monitor whether human agents follow correct workflows               | Session recording, observation |

## Authentication readiness

Loading an app URL or restoring a Browserbase context does not prove authentication. Every login and saved-context readiness check now evaluates the current page’s visible DOM in one call. It requires HTTPS `app.travel.example` with an `/app` path boundary, visible account controls (for example Profile, Account menu or Sign out), and visible travel navigation or both origin/destination search controls. User information in the URL, explicit ports, lookalike origins and unrelated paths are rejected. Visible sign-in, password, email, username, SSO, signup or verification controls/text take precedence over workspace evidence. Hidden controls and form values are not used as proof.

The classifier returns authenticated, unauthenticated or unknown. Ambiguous shells, failed observations and missing positive controls never satisfy readiness. These are English semantic control checks, not verified selectors for every Travel portal account or an account-identity check. If a real workspace uses different labels, inspect that workspace and adapt the collector with a corresponding fixture; do not restore the former URL/text-length shortcut.

Context setup verifies the workspace separately after manual completion and fails if verification remains inconclusive. Session state may still persist when the browser closes, but the command no longer calls that saved authentication or recommends benchmarking as though it had succeeded. Login success does not prove subsequent flight search or price extraction success.

Run `node --test tests/*.test.mjs` on Node 24. Local browser tests use an already installed `playwright-core` via `PLAYWRIGHT_MODULE_PATH`, plus system Chrome (override with `CHROME_EXECUTABLE_PATH`); they explicitly skip if unavailable and do not download a browser. All 47 tests passed locally with Chrome: classifier/DOM fixtures, actual login and context-readiness callers, and context setup’s failure/success reporting with synthetic dependencies. The complete index and its imported helpers also pass an isolated TypeScript check against installed SDK types. The original password-sign-in false positive was reproduced before the fix. No live Travel portal session, saved context, credentials or model/provider call was used; this is not a fresh dependency installation or live compatibility guarantee.

## Dates and report outcomes

Set `BENCHMARK_DEPARTURE_DATE=YYYY-MM-DD` to choose a departure date. If omitted, all routes use 30 UTC calendar days from today. Explicit dates must be valid calendar dates strictly after the current UTC day; blank, malformed, today and past dates are rejected before the benchmark allocates sessions. Each route is checked again before launching its sources. This replaces the fixed June 2026 departures.

Only positive finite nonstop prices without a source error and with an observation timestamp contribute to comparisons. The report recomputes differences from those source records rather than trusting cached comparison fields. It shows paired Travel Portal/external route counts, actual configured execution mode, recorded cloud session IDs when applicable, and each usable extraction’s completion time in UTC. A run with no usable fares is unsuccessful and exits with status 1. External-only or unpaired observations remain useful data but produce no Travel portal comparison conclusion. “Travel portal within $5” uses the existing five-dollar parity threshold, not a claim that Travel portal is always cheaper.

Source allocation failures are included as failed observations. `startedAt` records attempt start and `observedAt` records successful extraction completion, not the travel site’s original quote time. These fields are retained on the in-memory source records; the console report prints observation times. There is no automatic durable archive or fare-equivalence verification.

Date and report checks run with `node --test tests/benchmark-date.test.mjs tests/report.test.mjs` on Node 24. All 45 tests pass: 31 injected-clock date cases and 14 actual report/comparison/caller cases with synthetic sources. They verify invalid-date rejection before allocation, all-failed exit status, allocation failure accounting, valid paired and unpaired results, invalid price exclusion and observation timestamps. These checks make no booking, login, model or provider requests.


## Separate browser-agent and Stagehand model configuration

This benchmark uses two model configurations. The outer tool-calling agent uses OpenAI through the AI SDK and requires `OPENAI_API_KEY`. Its optional `AGENT_MODEL` is a bare OpenAI model ID, defaulting to `gpt-5.4-mini`; do not prefix it with `openai/`.

Stagehand's browser primitives use `MODEL_NAME`, defaulting to `anthropic/claude-sonnet-4-20250514`. `MODEL_API_KEY` overrides the primitive key. Without that override, `anthropic/` selects `ANTHROPIC_API_KEY`, `google/` selects `GOOGLE_API_KEY`, and `openai/` selects `OPENAI_API_KEY`. Other providers require an explicit `MODEL_API_KEY` and must still be supported by Stagehand. Setting only a primitive key does not configure the outer OpenAI agent.

```bash
# Default separate providers
OPENAI_API_KEY=your_outer_agent_key
ANTHROPIC_API_KEY=your_primitive_model_key
AGENT_MODEL=gpt-5.4-mini
MODEL_NAME=anthropic/claude-sonnet-4-20250514
```

Configuration is checked before local or Browserbase browser allocation, and context setup checks it before creating a context. Every created Stagehand instance retains its preconfigured outer model, which is passed explicitly to the browser task helper. These checks validate configuration presence and syntax locally; they do not validate credentials, model availability, or provider access.

`node --test tests/model-config.test.mjs tests/auth-callers.test.mjs tests/report.test.mjs` exercises the actual model/configuration functions with synthetic environments and provider factories. All 51 tests passed locally with Node 24, along with an isolated typecheck against the installed Stagehand and AI SDK contracts. No provider request or persistent context was created for these checks.
