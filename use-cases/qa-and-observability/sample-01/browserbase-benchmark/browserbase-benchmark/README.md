# Browserbase Benchmark Framework

A framework for benchmarking **Browserbase** against DIY browser infrastructure — Chromium
you run yourself on a cloud VM, in a sandboxed compute environment, or locally. Define what
to measure (scenarios), define what to compare (competitors), run anywhere (local, Render,
EC2), and get a self-contained HTML report with per-step timing breakdowns, W3C Navigation
Timing analysis, and cost comparison.

---

## How it works

The framework has three concepts:

**Competitors** — the browser infrastructure options being compared. Each competitor is a
TypeScript module in `src/competitors/` that knows how to create a Stagehand instance.
Browserbase and local Chromium are included out of the box. A DIY competitor is any
Chromium you run yourself — on a cloud VM, inside a sandboxed or serverless compute
environment, or on a remote host you control. Adding a new one means adding one file.

**Scenarios** — what to benchmark. Each scenario is a TypeScript module in `src/scenarios/`
that defines a sequence of named steps. Each step is an async function that receives a
Stagehand instance and page. The `init` step (browser session startup) is always measured
implicitly by the runner before any scenario steps run.

**Runner** — the engine that runs every combination of competitor × scenario × site × N
runs, collects timings, and saves results. The report then auto-generates charts from
whatever steps and competitors appear in the results — no hardcoded phase names.

```
competitor A ─┐
competitor B ─┤  ×  scenario  ×  site  ×  N runs  →  RunResult[]  →  report.html
competitor C ─┘
```

---

## Quickstart

Use Node 24.19.0. Local setup uses `.nvmrc`, Render sets `NODE_VERSION`, and EC2 installs the same official Node release with a pinned SHA-256 checksum. Full deployment and clean-install validation with this runtime remain pending.

```bash
nvm install
nvm use
npm install && npm run build
npx playwright install chromium  # for local-chromium competitor

cp .env.example .env
# Set BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID, GOOGLE_API_KEY, BENCHMARK_SITES
```

```bash
npm run benchmark                 # all scenarios × all competitors
npm run benchmark:local           # local-chromium only (no Browserbase credentials needed)
npm run benchmark:browser         # skip LLM steps (faster, no Google API key needed)
npm run report                    # generate report.html from latest results
```

---

## Extending the framework

### Adding a scenario

Create a file in `src/scenarios/`. Export a `scenario` constant typed as `Scenario`.
The runner discovers it automatically on the next build.

```typescript
// src/scenarios/checkout-flow.ts
import type { Scenario } from "../types.js";

export const scenario: Scenario = {
  name: "checkout-flow",
  description: "Measures latency of a multi-step e-commerce checkout",
  steps: [
    {
      // Name this step "goto" to trigger automatic W3C Navigation Timing
      // and CDP overhead analysis in the report (see note below).
      name: "goto",
      async run(_stagehand, page, { site }) {
        await page.goto(site, { waitUntil: "domcontentloaded" });
      },
    },
    {
      name: "add-to-cart",
      async run(stagehand, _page, { browserOnly }) {
        if (browserOnly) return;
        await stagehand.act("Click the Add to Cart button");
      },
    },
    {
      name: "go-to-checkout",
      async run(stagehand, _page, { browserOnly }) {
        if (browserOnly) return;
        await stagehand.act("Click the Checkout button");
      },
    },
    {
      name: "extract-order-summary",
      async run(stagehand, _page, { browserOnly }) {
        if (browserOnly) return;
        await stagehand.extract("Extract the order total and item count");
      },
    },
  ],
};
```

**Notes:**
- The `init` step is always measured before your steps run — do not include it.
- `ctx.site` contains the URL for the current benchmark run.
- Any step that calls `stagehand.act()` or `stagehand.extract()` should check `ctx.browserOnly`
  and return early if true — this lets your scenario support the `--browser-only` flag.
- Wrap risky steps (`act`, form submissions) in `try/catch` if a failure shouldn't abort the run.

> **`goto` is a reserved step name.** Name your navigation step `goto` and the runner
> automatically collects W3C Navigation Timing (DNS, TCP, TLS, TTFB, download, DCL) and
> page complexity metrics after it completes. These power the CDP overhead breakdown and
> nav timing charts in the report. Use any other name and those sections won't appear —
> there's no error, they're just silently skipped.

### Adding a competitor

A DIY competitor is any Chromium instance you run yourself instead of using Browserbase:

- **Cloud VM** — Chromium on a persistent remote host (EC2, Render, Fly.io, etc.), connected via CDP WebSocket
- **Sandboxed compute** — Chromium inside an ephemeral compute environment (serverless functions, containers, sandbox platforms), exposed via CDP WebSocket
- **Local process** — Chromium launched on the same machine as the agent (the baseline `local-chromium` competitor)

Create a file in `src/competitors/`. Export a `competitor` constant typed as `Competitor`.

Start from a built-in factory that already follows the installed Stagehand lifecycle. For example, give the local Chromium implementation a separate competitor identity:

```typescript
// src/competitors/custom-chromium.ts
import { competitor as local } from "./local-chromium.js";
import type { Competitor } from "../types.js";

export const competitor: Competitor = {
  ...local,
  name: "custom-chromium",
  label: "Custom Chromium",
};
```

This runs the same implementation until you change the factory. For different browser infrastructure, adapt its launch/connection step using the installed SDK's browser adapter contract.

`createStagehand()` must return a ready Stagehand instance with a connected browser and a page. The runner measures the entire awaited factory call as `init`; it does not call `.init()`. Include browser launch/connection and `Stagehand.create(...)` inside the factory, as the built-in competitors do. These startup measurements are included in `total`; cleanup and post-navigation metric collection are outside that total.

Each factory receives a resource owner: `createStagehand(resources)`. Register the browser immediately with `await resources.own(await adapter.launch(...))`, then register the ready Stagehand instance the same way. This closes the browser if Stagehand setup fails. Custom steps receive `context.signal`; pass it to cancellable operations and check it between non-browser operations.

Each measurement has a 60-second cancellation deadline. At the deadline the runner aborts the signal and starts closing owned handles, including handles returned late during initialization. It awaits the operation and cleanup before starting another measurement. Cleanup failures stop the benchmark. The deadline timer is cleared on every exit.

This is cooperative cancellation, not a hard process deadline: an SDK call or cleanup promise that never settles keeps the benchmark busy. Browser closure does not prove that a remote model request has stopped billing. A hung run requires operator recovery; it never silently advances into overlapping measurements.

> **`browserbase` is a reserved competitor name.** The report recognizes the name
> `"browserbase"` to enable the per-step overhead callout and cost analysis sections.
> Rename it (e.g. `"browserbase-eu"`) and those report sections won't appear — silently,
> with no error. If you need multiple Browserbase variants, keep one named `"browserbase"`
> as the primary.

### Rebuilding after changes

```bash
npm run build
```

Discovery runs against `dist/scenarios/` and `dist/competitors/` at runtime — always
rebuild before running the benchmark.

---

## CLI reference

```bash
npm run benchmark [-- <flags>]
```

| Flag | Description | Default |
|---|---|---|
| `--sites <urls>` | Comma-separated URLs to benchmark | `$BENCHMARK_SITES` |
| `--runs <n>` | Runs per site × scenario × competitor | `$BENCHMARK_RUNS` (5) |
| `--scenarios <names>` | Comma-separated scenario names to run | all discovered |
| `--competitors <names>` | Comma-separated competitor names to run | all discovered |
| `--local-only` | Shorthand for `--competitors local-chromium` | — |
| `--browser-only` | Skip LLM steps (extract, act) in scenarios that support it | — |

```bash
# Run a specific scenario against all competitors
npm run benchmark -- --scenarios basic-navigation --runs 10

# Compare two specific competitors
npm run benchmark -- --competitors browserbase,local-chromium

# Quick browser-only run against a custom site
npm run benchmark -- --sites https://yourapp.com --browser-only --runs 3
```

---

## Reading the report

`npm run report` generates `report.html` from the latest results file. Pass `--all` to
aggregate across all result files. If the input contains multiple scenarios, a scenario selector opens an independently calculated report for each workload. Timing, navigation, page and cost summaries use only that scenario; there is no mixed-workload average. Export PDF inside the selected report to print that scenario.

Dashboard report links accept result filenames with or without `.json`. IDs may contain letters, numbers, dots, underscores and hyphens and must begin with a letter or number. Paths and symlinks are rejected. Missing selected files return404; empty or invalid JSON returns422. Empty CLI reports fail with a message to run a benchmark first. Reports containing failed runs remain available for diagnosis.

### Step waterfall

Horizontal stacked bars per competitor. One bar group per test site, each bar showing
cumulative time for every step. Makes the shape of the overhead visible at a glance —
if `init` is tall for Browserbase but subsequent steps are near-parity, that confirms
the cost is session provisioning, not ongoing CDP transport.

### Overhead callout (when Browserbase is present)

The per-step comparison table uses all successful observations. It averages the per-site medians and quartiles for each competitor; it is not a fast-subset comparison or a pooled median. The navigation breakdown uses successful observations with navigation timing. The threshold count is a separate diagnostic and does not filter these summaries. Inspect the measured steps without assuming initialization or a particular routing path explains the difference.

### goto() breakdown — network round-trip vs page load

Only shown when results include a `goto` step. Splits `goto()` time into:
- **Page load** — W3C Navigation Timing sum (DNS + TCP + TLS + TTFB + download + DCL).
  Measured inside the browser, independent of CDP transport. Should be equal between
  competitors on the same site.
- **CDP overhead** — the remainder (`goto_ms − nav_sum`). For local Chromium this is
  local IPC (near zero). For Browserbase it reflects the DevTools Protocol round-trip
  over the network.

If page load is equal and only CDP overhead differs, the entire `goto()` delta is pure
transport cost, not page variation.

### W3C Navigation Timing breakdown

Stacked bars per competitor per site: DNS / TCP / TLS / TTFB / download / DCL. Confirms
whether any `goto()` difference is from the page itself or from infrastructure.

### Page complexity table

DOM node count, subresource count, and transfer size per site. Provides context: a slower
`extract` on amazon.com compared to chatgpt.com is the page's complexity, not the
runner's overhead.

### Cost analysis (when Browserbase is present)

Compares monthly TCO for self-hosted (Render Pro compute + ops engineering + feature
parity build amortized) vs Browserbase (Render Starter + browser-hour API). Includes
breakeven session volume above which Browserbase's variable API cost surpasses the
fixed self-hosted overhead.

---

## Deployment

### Render (example)

This is how we deployed the benchmark for [Sample Organization](https://sample_org.com), who use Render
for their infrastructure. The benchmark server runs as a persistent Render web service —
trigger runs from the dashboard UI or CLI, and view HTML reports directly in the browser.
Adapt the setup table below for whatever hosting platform you're using.

**Render setup:**

| Setting | Value |
|---|---|
| Runtime | Node |
| Build command | `npm install && npm run build && npx playwright install chromium` |
| Start command | `node dist/server.js` |
| Plan | **Pro** (4 GB RAM — Chromium requires it for the local-chromium competitor) |
| Region | Oregon (us-west) — same region as Browserbase default |
| Health check path | `/health` |

Environment variables to set in the Render dashboard:

| Key | Description |
|---|---|
| `BROWSERBASE_API_KEY` | Browserbase API key |
| `BROWSERBASE_PROJECT_ID` | Browserbase project ID |
| `GOOGLE_API_KEY` | Google API key (for LLM steps with default Gemini model) |
| `BENCHMARK_SITES` | Comma-separated URLs to benchmark |
| `BENCHMARK_ACCESS_TOKEN` | Private 64-character hexadecimal token, also configured in the CLI environment |
| `BENCHMARK_PUBLIC_ORIGIN` | Exact HTTPS service origin, without a trailing slash |
| `PLAYWRIGHT_BROWSERS_PATH` | `/opt/render/project/src/browsers` |

`PLAYWRIGHT_BROWSERS_PATH` tells Playwright to install Chromium inside the project
directory (which persists to the runtime container).

**Trigger a run from the CLI:**

```bash
npm run run:render                        # full run (all scenarios × all competitors)
npm run run:render:browser                # browser-only (skip LLM steps)
```

`RENDER_SERVICE_URL` must be set in `.env`, or pass it inline:

```bash
RENDER_SERVICE_URL=https://your-service.onrender.com npm run run:render
```

To override sites or run count, use `scripts/run.sh` directly:

```bash
bash scripts/run.sh --render --sites https://yourapp.com --runs 3
bash scripts/run.sh --render --browser-only --runs 5
```

Supported flags for the Render flow: `--sites <urls>`, `--runs <n>`, `--browser-only`.
Scenario and competitor filtering isn't supported via CLI — control those through the
service's env vars (`BENCHMARK_SITES`, `BENCHMARK_RUNS`) in the hosting dashboard.

An accepted POST returns `runId`. Retrieve that run with `GET /results?runId=<id>`; the response is202 while running,200 with its result array, or an error. `/results` without an ID returns400. Update the launcher and server together; older services without run IDs are rejected explicitly. The launcher saves `<runId>.json` and reports that exact file. Completed IDs remain readable while later runs execute.

POST `/run` accepts a JSON object with string site/filter fields, boolean mode flags, and an integer run count from 1 to 100. Invalid or interrupted requests return400 and do not start a benchmark. Overlapping valid requests receive409 while a run is active.

Or open `https://your-service.onrender.com` in a browser to start runs and view
report history from the dashboard UI.

### EC2

Provisions a `t3.large` EC2 instance in `us-west-2`, runs the benchmark, downloads
results, and tears the instance down. Useful for isolated, reproducible cloud environments
without a persistent service.

```bash
npm run run:ec2                              # provision → benchmark → report → destroy
bash scripts/run.sh --no-destroy            # keep instance alive after for inspection
bash scripts/run.sh --sites https://... --runs 5
```

Each EC2 invocation uses its own ignored `.benchmark-runs/run.*` directory and uniquely named AWS resources. Cleanup is registered before apply, including partial provisioning and output failures. The launcher never reuses the source `infra/terraform.tfstate`. Existing deployments from older versions require separate cleanup using their original state.

With `--no-destroy`, or if automatic cleanup fails, keep the printed Terraform directory. It contains the state needed for recovery. To clean up later, change into that exact directory and run `terraform destroy -var 'region=<the region printed by the launcher>'` with the same AWS account credentials. State files may contain sensitive infrastructure data; keep them private. A failed run preserves its original exit code even if cleanup also fails.

**Additional requirements:** [Terraform](https://developer.hashicorp.com/terraform/downloads) ≥ 1.5, AWS CLI configured, `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` in `.env`.

The script: validates credentials → `terraform apply` (t3.large in us-west-2, ~90 sec) →
waits for SSM → packages compiled output + credentials → runs via SSM (no inbound ports
needed) → downloads results → generates `report.html` → `terraform destroy`.

### Local

Runs from your machine. Useful for development and iteration, but **not representative of
production latency** — local Chromium runs on your machine while Browserbase connects to
us-west-2, so timing comparisons are not apples-to-apples.

```bash
npm run benchmark                 # all competitors + scenarios
npm run benchmark:local           # local-chromium only
npm run report                    # generate report.html from latest results
```

---

## Environment variables

### Always required

```bash
# Browserbase credentials — needed for the browserbase competitor
BROWSERBASE_API_KEY=
BROWSERBASE_PROJECT_ID=
BROWSERBASE_REGION=us-west-2       # optional, default us-west-2

# Sites to benchmark
BENCHMARK_SITES=https://chatgpt.com,https://espn.com,https://amazon.com
```

### LLM (required for AI steps; not needed with `--browser-only`)

```bash
# Default model: Google Gemini 2.5 Flash
# Get a key at https://aistudio.google.com/apikey
GOOGLE_API_KEY=

# To use a different provider, set BENCHMARK_MODEL and its key:
#   BENCHMARK_MODEL=anthropic/claude-opus-4-5  →  ANTHROPIC_API_KEY=
#   BENCHMARK_MODEL=openai/gpt-4o              →  OPENAI_API_KEY=
# Stagehand auto-reads ANTHROPIC_API_KEY / OPENAI_API_KEY for those providers.
BENCHMARK_MODEL=google/gemini-2.5-flash
```

### Competitor-specific keys

Set only the keys for competitors you're actually running.

```bash
# DIY remote Chromium — set to the CDP WebSocket URL your Chromium exposes.
# Works for cloud VMs (EC2, Render, Fly.io), sandbox compute, containers, etc.
DIY_CHROMIUM_WS_URL=ws://your-chromium-host/
```

### Deployment

```bash
# Render — used by npm run run:render
RENDER_SERVICE_URL=

# AWS — required for EC2 provisioning (npm run run:ec2)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-west-2
```

### Optional / tuning

```bash
BENCHMARK_RUNS=5                   # runs per site × scenario × competitor
LOCAL_CHROMIUM_EXECUTABLE=         # explicit path; auto-detected if unset
PLAYWRIGHT_BROWSERS_PATH=          # set on Render to persist browser cache

# Cost analysis inputs (used in report.html cost section)
SESSIONS_PER_DAY=500
AVG_SESSION_MINUTES=3
OPS_HOURS=8                      # finite nonnegative modeled operations hours/month
```

---

## Project structure

```
src/
  scenarios/              # Add new benchmark scenarios here
    basic-navigation.ts   # init · goto · screenshot · extract · act
    search-extract.ts     # init · goto · search · extract
  competitors/            # Add new competitor definitions here
    browserbase.ts        # Managed remote browser (CDP over network)
    local-chromium.ts     # Self-hosted Chromium (local IPC)
  runner.ts               # Generic execution engine + CLI entry point
  discover.ts             # Auto-discovers scenarios and competitors from dist/
  report.ts               # Generates report.html — adapts to any steps/competitors
  server.ts               # Dashboard server: POST /run, GET /report, GET /status
  types.ts                # Core interfaces: Scenario, Step, Competitor, RunResult
  chromium.ts             # Chromium binary resolution (env → known paths → playwright)
  cost.ts                 # TCO calculation for cost section of the report
infra/
  main.tf                 # EC2 t3.large + SSM IAM + egress-only security group
  variables.tf
  outputs.tf
  user_data.sh            # Amazon Linux 2023 bootstrap: Node 24.19.0 + Playwright deps
scripts/
  run.sh                  # Orchestrator: local → render-run.sh or EC2 → Terraform flow
  render-run.sh           # Render flow: health-check → POST /run → poll → report
results/                  # JSON result files (gitignored)
.env.example              # All env vars with descriptions
render.yaml               # Render service definition
```

---

## Result format

Results are saved as `results/<timestamp>.json` — an array of `RunResult` objects:

```typescript
interface RunResult {
  competitor: string;              // e.g. "browserbase", "local-chromium"
  scenario: string;                // e.g. "basic-navigation"
  site: string;                    // URL
  runIndex: number;
  steps: Record<string, number>;  // step name → duration ms; always includes "init"
  total: number;                   // sum of all steps
  metadata?: {
    host?: string;                 // "render" | "ec2" | "local-machine"
    sessionId?: string;            // Browserbase session ID if applicable
    navigation?: NavigationTiming; // W3C nav timing (collected after "goto" step)
    page?: PageMetrics;            // DOM nodes, resources, transfer bytes
  };
  error?: string;
}
```

The report reads whatever step names and competitor names exist in the results and
generates charts dynamically — adding a new step to a scenario or a new competitor
file automatically appears in the report with no report-side changes needed.

### HTTP server access

Every dashboard, status, run, result and report endpoint requires authentication. Only `GET /health` is public. Set `BENCHMARK_ACCESS_TOKEN` to a randomly generated 32-byte value encoded as 64 hexadecimal characters; keep it private and configure the same value on the server and local Render launcher. Missing or invalid server configuration returns503 for protected routes.

Opening the dashboard prompts for HTTP Basic credentials: username `benchmark`, password your access token. The browser uses these credentials for its same-origin fetches and report links. API clients can send `Authorization: Bearer <token>`. Never put the token in URLs. Serve through HTTPS outside localhost, and set `BENCHMARK_PUBLIC_ORIGIN` to the exact deployed origin so browser control requests pass the origin check. Cross-origin control requests are rejected; the server does not enable CORS.

The launcher writes its authorization header to a temporary mode0600 curl config, uses it for run/result requests, and removes it on exit. It does not put the token in command arguments or generated reports. Update launcher and server together. Token rotation invalidates saved browser credentials and existing CLI configuration.

A request accepts1–10 distinct HTTP(S) site URLs,1–100 runs per site, and at most16KiB of JSON. These are per-request limits, not a monthly spending quota. The existing single-run concurrency guard remains in effect. Local tests use synthetic credentials and do not deploy or run paid competitors.
