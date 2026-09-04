# Dev notes / Phase 2 resume state

Internal working notes (not customer docs — see README for those). Captures state so work can resume
after a context compaction.

## ⭐ LATEST STATUS (2026-06-24) — supersedes the stale sections below
**All 10 workflows + login working. No-params shape; Browserbase key supplied through runtime env.**

- **No params anymore.** Workflow functions take `{}`. The BB key comes from `BROWSERBASE_API_KEY` in the
  runtime environment. The 9 deterministic functions get the login context via
  `sessionCreateParams.browserSettings.context` at invoke; the agent-assisted functions read saved context IDs
  from runtime env. login-finish is the only function with params (`sessionId`, `contextId`).
- **The 9 deterministic workflows**: done, re-validated end-to-end (services 36, team 8, unavail 1, packages
  2, reviews 4, client-packages 6, appointments 36, products 7, customer-list 3170). IDs below.
- **customer-notes (NEW, 10th): WORKING via the hosted Stagehand agent.** Not deterministic — Square notes
  are export-only. The function calls `POST https://api.stagehand.browserbase.com/v1/sessions/{ctx.session.id}/agentExecute`.
  Cracked details: model is a **plain string** `"anthropic/claude-haiku-4-5-20251001"` (NO `apiKey` in
  `agentConfig.model` → else `invalid x-api-key`; key only in `x-bb-api-key` header); **viewport 1288×711**
  required for the dashboard SPA to render (`__dashboard_web_is_shell` is a red herring); `keepAlive:true` +
  `timeout:900`; `streamResponse:true` (avoids undici ~5min headers timeout). Confirmed: Square's native notes
  CSV (`Customer ID,Note ID,Display Name,Note CreatedAt,Note Content`, 6316 B / 23 notes) downloads + syncs to
  the Downloads API in **dev and prod**.
  - **OPEN BUG:** the added map-to-schema step (`clientNotesCsv` → deliver `client-notes.csv`) fails —
    `shared/deliver.ts readZipEntry()` throws "could not read any entry" on the Square Downloads-API zip
    (likely data-descriptor entries; compSize=0 in local headers → it bails). `readZipEntry` was never
    exercised in prod (customer-list synthesizes its CSV). Fix = parse the central directory. Until then,
    customer-notes delivers Square's **raw** export reliably; mapped CSV pending.
  - `clientsCsv` in `shared/schema.ts` is now **dead code** (customer-list uses the protobuf `customersCsv`).
- **Local `browse functions dev`** ignores per-invoke `sessionCreateParams` — it builds the session from the
  function's static `sessionConfig` only. Invoke route: `POST http://127.0.0.1:14113/v1/functions/{name}/invoke`.
- **Stagehand 3.2.1 does NOT build** (same `ollama-ai-provider-v2` zod-4 conflict as 3.6.0). Stay on 3.0.8.
- **Published to CUSTOMER account (key stored in the team password manager)** (2026-06-24, the 9 deterministic
  workflows, not run): services `4c53ed30`, team `5e752511`, unavail `a4dbfa34`, packages `9125bb63`,
  reviews `9a4acd34`, client-packages `18d3e1f8`, appointments `1b65411e`, products `be3bb27b`,
  customer-list `240486b4`. (Ziray also published customer-notes on the customer account.)
- **Known by-design schema blanks**: customer-list `Marketing consent`, products stock, reviews `client_email`,
  unavailabilities `location_name`, customer-notes email/phone (downstream join) + Note author.

---
### (Below: earlier phase history — partly stale; kept for context)

## Validated calling convention (runtime-session pattern — DONE + re-validated across all 9)
Workflow functions now run on the RUNTIME session (`ctx.session`) bound to the login context via the invoke
body's `sessionCreateParams` (NOT a function param). No self-created session.
```
login-start   params { apiKey }                         → { contextId, sessionId, liveViewUrl }
login-finish  params { apiKey, sessionId, contextId }   → { contextId }
<workflow>    POST /v1/functions/{fnUUID}/invoke body:
  { "params": { "apiKey": "<bb key>" },
    "sessionCreateParams": { "browserSettings": { "context": { "id": "<contextId>", "persist": false } } } }
              → small result + sessionId; CSV is an in-session download, fetched via the Downloads API (zip)
```
- `params.apiKey` is only for the in-function Downloads-API client; the login CONTEXT goes in
  `sessionCreateParams`. No `projectId` needed. Invoke by function UUID (`builtFunctions[0].id`).
- NOTE: `browse functions invoke --params` only sends `params` (no sessionCreateParams) → use **curl** for
  workflow invokes (see the validation loop), or extend the CLI.
- Re-validated 2026-06-24: all 9 ok:true — services 36, team 8, unavail 1, packages 2, reviews 4,
  client-packages 6, appointments 36, products 7, customer-list 3170(→3169 clients).

## Published function IDs (project agent-api-demo = e12cd8e2-3efe-47c1-9ed1-6400fc1f25ed)
- square-login-start       `6b1fbab5-9e29-4503-8a97-676ccd3e51a7`
- square-login-finish      `7a66bd34-ad2c-4118-89ef-530aff6fdda4`
- square-services-list     `5e307d77-8782-4618-9c62-166a53d145ee`  ✅ validated (36 rows)
- square-team-members      `548fcf8e-d1c3-4633-a9a8-10c5e2a38e45`  ✅ validated (8 rows)
- square-unavailabilities  `562c0d7f-1420-44ed-ab8a-74a326a7b118`  ✅ validated (1 row)
- square-packages          `7814877d-6c9c-4885-bdda-e96cf29690d3`  ✅ validated (2 rows)
- square-reviews           `4addb30f-7474-4b89-9766-d39402da29c8`  ✅ validated (4 rows, sentiment→rating)
- square-client-packages   `a289b971-1f9d-4cea-89dd-c71684d064ab`  ✅ validated (6 rows)
- square-appointments-list `43230082-3560-496d-9da6-10092bdf7e0e`  ✅ validated (36 rows; see caveat)
- square-customer-list     `625e68b1-e0b2-46ee-a0ac-c64f48cc49ec`  ⚠ agent ran via gateway but didn't complete Square's export (agentSuccess=false) — needs tuning
(IDs are stable per function name across re-publishes; re-publish to get a new build/version.)

## PIVOT (in progress): make all 10 deterministic → drop Stagehand entirely → kills the build problem
Decision: the agent/model-gateway path is blocked by a build-infra limit (Stagehand 3.6.0's dep tree won't
`npm ci` in the Functions build container — proven installs locally, fails in cloud regardless of npm/node/
zod). So pivot the 3 agent workflows to deterministic API replays like the other 7. None of the deterministic
functions import Stagehand (they use `openSquareSession` = BB SDK + connectOverCDP + page.evaluate), so once
all 10 are deterministic we DROP `@browserbasehq/stagehand` → lean dep tree builds fine, no gateway needed.
- **products** ✅ DONE deterministically (catalog API, product_type REGULAR). Validated: 7 rows. Stock count /
  low_quantity_level blank (need Square inventory API — TODO/gap, like appointments segments).
- **customer-list** ✅ DONE deterministically via `SearchAndGetCustomers` protobuf (NO CreateExport needed!).
  Contact fields: fn1=token, fn3=first, fn4=last, fn6=email, fn7=phone. Validated: 3169 clients (matches
  local). Marketing consent left blank (not reliably identifiable in the fn21–25 flag varints).
- **customer-notes** ⛔ BLOCKED (deterministic path exhausted). Findings:
  - No notes API: SearchAndGetCustomers has no note fields; the customer profile fires no notes RPC on load.
  - Notes only come from Square's UI export (Import/Export → Export notes → CreateExport protobuf → poll →
    download). CreateExport can't be constructed blind (local repo CAPTURED it via UI interception).
  - **The Square dashboard SPA won't render headlessly** in the Functions browser — it loads in "shell" mode
    (`window.__dashboard_web_is_shell=true`) and stays on the loading screen. Confirmed on BOTH a self-created
    session and the runtime session, even after dismissing the OneTrust cookie banner (`accept-recommended-
    btn-handler`) + 16s wait (`stillLoading:true`). So the export UI is unreachable → can't trigger/capture
    CreateExport headlessly. API replays work (they hit endpoints with the session cookies); only rendered-UI
    flows are blocked.
  - Paths forward (need eng/more work): (a) eng provides the notes export RPC / a notes JSON API; (b) capture
    CreateExport once in a real browser, then replay the protobuf; (c) the LLM agent (build-blocked today).
  - DETERMINISTIC API-REPLAY ATTEMPT (2026-06-24) — exhausted, all from the headless Functions browser:
    1. No notes content in `SearchAndGetCustomers` (only token/name/email/phone/flags).
    2. Customer profile fires no notes RPC on load (dashboard stuck in shell mode, never mounts).
    3. JS-bundle grep for the RPC path: fetched 220/892 dashboard chunks (CORS open) — `ExportStatus` is the
       only export-ish literal; NO CreateExport / CustomersWebFeService method / notes/profile RPC path found
       (the rest are unloaded chunks and/or RPC paths built dynamically, so not greppable).
    4. UI trigger/capture blocked — dashboard SPA won't render headlessly (shell mode + OneTrust).
    CONCLUSION: notes can't be done as a pure API replay from the HEADLESS function. The only deterministic
    route is **capture the CreateExport request ONCE in a real (non-headless) browser** — where the dashboard
    renders, click Import/Export → Export notes, capture the protobuf request bytes + endpoint (the local
    `sample_org-square-demo` customer-notes workflow already does this) — then the function replays those
    bytes deterministically (parameterizing the account merchant/location tokens via the M-scan we use
    elsewhere) → poll ExportStatus → download. No agent/inference in the function; the capture is one-time.

### ✅ Runtime-session pattern (eng-confirmed + VALIDATED) — recommended refactor for all functions
The invoke body accepts `sessionCreateParams` → the runtime's OWN `ctx.session` is bound to our login context
per-invocation. So we DON'T need `openSquareSession`'s `bb.sessions.create` (no redundant session). Validated:
`ctx.session.connectUrl` came up authed, catalog returned 34 items.
- Invoke: `POST /v1/functions/{id}/invoke` body `{ "params": {...}, "sessionCreateParams": { "browserSettings":
  { "context": { "id": "<contextId>", "persist": false } } } }`
- Function: `const browser = await chromium.connectOverCDP(ctx.session.connectUrl)` → page (already authed).
  Keep CDP `setDownloadBehavior` + a BB client (params.apiKey) only for `sessions.downloads.list(ctx.session.id)`.
- Refactor TODO: `openSquareSession(ctx, apiKey)` → connect to `ctx.session`; drop the self-created session;
  move `contextId` from params into the caller's `sessionCreateParams`. Mechanical across the 9 + re-validate.
Once customer-notes is deterministic: delete `functions/_agentprobe.ts` (the only remaining Stagehand import),
remove `@browserbasehq/stagehand` from package.json, republish → fully deterministic, lean tree, builds.

## Status: 8/10 workflow functions + login validated end-to-end (all match local repo row counts)
Done (deterministic, Downloads-API delivery): services, team-members, unavailabilities, packages, reviews,
client-packages, appointments-list. Login start/finish done.

Caveat — appointments: 26/36 rows fully resolve service+provider+price; ~10 rows have those blank because
their data lives in the reservation's `segments` array (empty `cart`), which the deterministic extract
doesn't yet read. Client/date/location/status/duration/rrule are correct on all 36. FIX: in
EXTRACT_APPOINTMENTS, when `cart.line_items.itemization` is empty, fall back to `r.segments[]` for service
(service_id→catalog) + staff. (Probe the segments shape first.)

## BLOCKER: Stagehand agent + model gateway config in-function (need exact config from BB team)
The 3 agent functions need a Stagehand agent driven through the BB model gateway (auth = BB API key as the
model key). Team says it "should work," but every config tried rejects the key or crashes. Model wanted:
**Haiku 4.5** = `anthropic/claude-haiku-4-5-20251001` (now DEFAULT_MODEL). Full matrix (each = publish+invoke
against a live Square session):

| env | agent | model key | model id | result |
|---|---|---|---|---|
| LOCAL (connectOverCDP) | `agent({mode:"hybrid"})` | BB key | sonnet-4 / haiku-4.5 | `invalid x-api-key` |
| LOCAL | `agent({mode:"hybrid"})` | Anthropic key | claude-3-5-sonnet | `No LLM API key configured` (act/extract) |
| LOCAL | modelName+modelClientOptions | Anthropic key | claude-3-5-sonnet | `No LLM API key configured` |
| BROWSERBASE (+projectId) | `agent({mode:"hybrid"})` | BB key | haiku-4.5 | `invalid x-api-key` |
| BROWSERBASE (+projectId) | `agent()` (no mode) | BB key | haiku-4.5 | WORKLOAD_ERROR (crash) |

Notes: env:BROWSERBASE needs `BROWSERBASE_PROJECT_ID` (set it + pass projectId). Stagehand 3.0.8 page access
is `await sh.context.awaitActivePage()` (not `sh.page`).

### Root cause traced (stagehand 3.0.8 dist/index.js)
- The **model gateway only engages on the NON-experimental path**: guard at `:68293`
  `if (!this.disableAPI && !this.experimental)` → creates the hosted `StagehandAPIClient` (`:68295`) and calls
  `apiClient.init({ modelName, modelApiKey: this.modelClientOptions.apiKey, ... })` (`:68312`). That client
  sends `x-model-api-key: <modelApiKey>` to the gateway (`:67582`) and throws `"modelApiKey is required"`
  (`:67150`) if absent. So my early `experimental:true` tests SKIPPED the gateway → used local LLM clients →
  "provider key required". And Haiku 4.5 IS in `AVAILABLE_CUA_MODELS` (`:24173`), so the model id is valid.
- **Correct gateway config (gets past all key checks):**
  `new Stagehand({ env:"BROWSERBASE", model:"anthropic/claude-haiku-4-5-20251001",
   modelClientOptions:{ apiKey: <BB key> }, browserbaseSessionCreateParams:{ browserSettings:{ context:{id,persist:false} } } })`
  (NO `experimental`), + `BROWSERBASE_API_KEY`/`BROWSERBASE_PROJECT_ID` env set, + `sh.agent({ model, mode:"cua" })`.
- **Remaining blocker:** that exact config then **crashes with a bare `WORKLOAD_ERROR`** (no detail; invocation
  logs not retrievable via CLI). The non-experimental path creates its OWN session via the hosted Stagehand
  API (`createSessionPayload` at `:68300`, using our `browserbaseSessionCreateParams`+context) — this may not
  work inside the sdk-functions 0.0.5 runtime, or there's a missing config.

### ✅ WORKING AGENT CONFIG (cracked — runs end-to-end through the non-experimental gateway path)
```ts
const bb = new Browserbase({ apiKey });
const session = await (bb.sessions.create as any)({ proxies:false, browserSettings:{ context:{ id: contextId, persist:false }, viewport:{width:1288,height:711} } });
process.env.BROWSERBASE_API_KEY = apiKey; process.env.BROWSERBASE_PROJECT_ID = projectId;
const sh = new Stagehand({
  env: "BROWSERBASE",
  model: { modelName: "anthropic/claude-haiku-4-5-20251001", apiKey },  // key INSIDE model (NOT modelClientOptions)
  browserbaseSessionID: session.id,                                     // CONNECT to our context-bound session (no crash)
  verbose: 0,                                                            // NO `experimental` → gateway path engages
} as any);
await sh.init();
const page = await sh.context.awaitActivePage();
const agent = sh.agent({ model, mode: "cua" });   // Haiku 4.5 ∈ AVAILABLE_CUA_MODELS
await agent.execute({ instruction, maxSteps });
```
Why: `resolveModelConfiguration(opts.model)` (`:67784`) pulls the model key from `model.apiKey` (a separate
`modelClientOptions` constructor field is ignored). `experimental:true` SKIPS the gateway → key sent direct
to the provider. With the above, all stages pass: `sh.init OK → navigated → agent created → agent executed`.

### REMAINING: gateway rejects our BB key — `invalid x-api-key`
With the correct config the agent runs, but the gateway returns `invalid x-api-key`. This is now a KEY/PROJECT
PROVISIONING issue, not config: the key/project needs **model-gateway access enabled** (or use a
gateway-enabled key). Ask Ziray to enable model gateway for the key/project. Once enabled,
flip the 3 agent functions to the config above (it's in `functions/_agentprobe.ts`).

### THE CORE CONFLICT (version): build-compatible Stagehand ⟂ gateway-capable Stagehand
- Thomas: for the gateway, **pass NO model key** — `model: "anthropic/claude-haiku-4-5-20251001"` (string only);
  a key makes Stagehand go direct to the provider (→ `invalid x-api-key`). `env:"BROWSERBASE"` +
  `BROWSERBASE_API_KEY` env authenticates the gateway. This is correct on **newer Stagehand**.
- BUT we're pinned to **stagehand 3.0.8** because the Functions cloud build REJECTS newer versions. Confirmed
  cleanly: `sdk-functions@0.0.5 + stagehand@3.6.0` (isolated, no fflate, no extra deps) → build `WORKLOAD_ERROR`.
- And **3.0.8 can't do the no-key gateway**: its non-experimental path requires `modelApiKey` (from
  `model.apiKey`), so no-key → `modelApiKey is required`, and with-key → bypasses gateway → `invalid x-api-key`.
- **Net:** the agent (cua) model gateway needs a Stagehand newer than what the Functions build accepts.

### ASK THE TEAM (Thomas + Ziray / Functions build owners)
Which **`@browserbasehq/sdk-functions` + `@browserbasehq/stagehand` versions BOTH (a) build in the Functions
cloud runtime AND (b) support the no-key model-gateway agent**? Today: 3.0.8 builds but lacks no-key gateway;
3.6.0 has it but fails the build (`Build failed to generate manifests`). Need a version pair that does both
(or a fix to the build so latest stagehand publishes). Then the agent functions use Thomas's config
(no key, model string, env:BROWSERBASE, mode:"cua") — ready in `functions/_agentprobe.ts`.

### ASK ZIRAY / Stagehand team
Does the **non-experimental** hosted-`StagehandAPIClient` path work inside a Browserbase Function
(sdk-functions 0.0.5)? Our gateway config above crashes (`WORKLOAD_ERROR`, no logs) at/after `sh.init()` or
the cua agent. Need: the working in-function snippet + how to see invocation logs. Plug the answer into
`functions/_agentprobe.ts`. The deterministic 7 don't use the agent and are unaffected.

## Remaining (agent-based — BLOCKED on the above; iterative, need a live Square login to tune)
- **customer-list** — built; tune the INSTRUCTION/maxSteps so the agent reliably completes Import/Export →
  Export customers → Download. Then Square's natural CSV syncs (setDownloadBehavior is in place) → clients mapper.
- **products** — tool-less agent: Actions → Export Library → CSV format → confirm; natural CSV → retail mapper
  (port `clientsCsv`-style from local `mapRetail`; one row per item per stocked location).
- **customer-notes** — hardest: protobuf CreateExport → poll ExportStatus(status=4) → download. Local had NO
  tool.ts (prompt-driven w/ fetch interceptor). Either port as a deterministic protobuf replay or a tool-less
  agent. Notes export columns → schema (Client name, email, phone [join — blank in-fn], note date, author
  [blank], note).

## How to publish + invoke (creds live in ../sample_org-square-demo/.env)
```
set -a; source ../sample_org-square-demo/.env; set +a   # BROWSERBASE_API_KEY
browse functions publish functions/<f>.ts --api-key "$BROWSERBASE_API_KEY"   # status COMPLETED
browse functions invoke <fnUUID> --params '{"apiKey":"...","contextId":"..."}' --api-key "$BROWSERBASE_API_KEY"
# fetch a result: curl -s https://api.browserbase.com/v1/sessions/<sessionId>/downloads -H "x-bb-api-key: $KEY" -o out.zip
```
Context replay needs a fresh Square login (login expires in hours): re-run login-start → user signs in via
liveViewUrl → login-finish. The user performs the interactive Square login (we don't have creds).

## Hard-won setup (also in README + memory reference_browserbase_functions_gotchas)
- Lockfile is pinned (based on company-news-function): sdk-functions 0.0.5, stagehand 3.0.8, sdk 2.6.0,
  playwright-core 1.58.2, zod 3.25.76. **DO NOT `rm package-lock.json && npm install`** — a fresh lock pulls
  newer transitives that fail the cloud build (confirmed even with NO stagehand). To change deps: `cp
  ../company-news-function/package-lock.json .` then `npm install` to reconcile (keeps the good pins).
- **Stagehand 3.0.8 stays as a (pinned) build dep even though NO function imports it at runtime** — removing
  it forced a fresh lock that broke the build. It's harmless (deterministic functions never use it). The
  agent/model-gateway path is abandoned; stagehand 3.6.0 (needed for the no-key gateway) won't `npm ci` in
  the build container anyway.
- `fflate` breaks the build (use node:zlib).
- `shared/session.ts` sets CDP `Browser.setDownloadBehavior {behavior:"allow", downloadPath:"downloads"}` —
  required or downloads never sync.
- No build/invocation logs via CLI → functions catch-and-return errors (`shared/result.ts`).

## Phase 2 — remaining 7 workflows (port from ../sample_org-square-demo)
Each: add `functions/<name>.ts` (mirror services-list/team-members template) + a mapper in
`shared/schema.ts` (port from `src/transform.ts`) + extraction in `shared/extract.ts` (port the endpoint/
request shape from the local `workflows/square/<name>/prompt.txt` browserEval or `tool.ts`).

Deterministic (page.evaluate API replay — no LLM):
- **appointments-list** — GET `/appointments/merchant/api/reservations` per (location × all staff), merge+
  dedupe by id; carry the multi-location/multi-staff + rrule work; mapper = appointments (rrule column).
- **unavailabilities** — GET `/appointments/api/events?date_start&date_end` (CSRF header).
- **packages** — POST `/v2/catalog/frontend/search` {product_types:["CREDIT_PACKAGE"], include_related_objects}
  then resolve bundle; mapper explodes bundle rows.
- **reviews** — POST `/api/v1/dialogue/conversations-list` (all-time) + `/api/v3/reports/transaction-families`
  join; mapper maps sentiment→rating column, client_email via clients join (note: cross-artifact joins need
  the clients CSV — in functions each runs standalone, so either skip the join or fetch clients too).
- **client-packages** — protobuf RPCs: SearchAndGetCustomers + per-customer SearchCreditPacks + catalog
  resolve. Port the protobuf encode/decode from the local tool.ts verbatim into the page.evaluate string.

Agent / UI-export (tool-less Stagehand agent, model gateway):
- **products** — Actions → Export Library → CSV format; read natural download → retail mapper.
- **customer-notes** — protobuf CreateExport → poll ExportStatus → download; agent-driven.
- **customer-list** — ALREADY built; agent runs via gateway but `agentSuccess:false` last run (didn't
  complete Square's export click on the test account). TUNE the instruction/maxSteps, then it should sync
  Square's natural download.

Open design note: cross-artifact joins (notes/reviews → clients email/phone; appointments → clients by name)
that the local transform does won't have sibling artifacts in a standalone function. Decide per workflow:
leave those columns blank (honest, documented) or have the function also pull the clients list.
