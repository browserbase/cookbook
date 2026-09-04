# Browserbase Benchmark Framework

## Install the team skill (one-time setup)

```bash
ln -s "$(pwd)/.claude/skills/benchmark-framework" ~/.claude/skills/benchmark-framework
```

This makes the `/benchmark-framework` skill available in Claude Code. Once installed,
Claude will automatically use it when you ask about adding scenarios, competitors,
running benchmarks, or understanding the codebase.

---

A framework for benchmarking Browserbase against DIY browser infrastructure — Chromium
you run yourself on cloud VMs or in sandboxed compute. Define competitors (what to compare)
and scenarios (what to measure), then run and get an HTML report.

## Key concepts

**Competitors** (`src/competitors/`) — a DIY browser alternative to compare against Browserbase.
Each file exports a `competitor` constant that knows how to create a Stagehand instance.
Two are included: `browserbase.ts` and `local-chromium.ts`. DIY competitors are Chromium
instances you run yourself: on cloud VMs, inside sandboxed compute environments, or locally.

**Scenarios** (`src/scenarios/`) — a sequence of named steps to benchmark. Each file
exports a `scenario` constant with an array of steps. Each step is an async function
receiving `(stagehand, page, { site, browserOnly })`. The `init` step (session startup)
is always measured implicitly before scenario steps run.

**Discovery** — the runner globs `dist/scenarios/*.js` and `dist/competitors/*.js` at
runtime. Adding a file and rebuilding is all it takes.

## Adding a scenario

Create `src/scenarios/<name>.ts`:

```typescript
import type { Scenario } from "../types.js";

export const scenario: Scenario = {
  name: "my-scenario",
  description: "What this measures",
  steps: [
    {
      name: "goto",
      async run(_stagehand, page, { site }) {
        await page.goto(site, { waitUntil: "domcontentloaded" });
      },
    },
    {
      name: "my-step",
      async run(stagehand, _page, { browserOnly }) {
        if (browserOnly) return; // skip in --browser-only mode
        await stagehand.act("...");
      },
    },
  ],
};
```

Note: name a step `goto` and the runner will automatically collect W3C Navigation Timing
and page complexity metrics after it.

## Adding a competitor

Create `src/competitors/<name>.ts`:

```typescript
import { Stagehand } from "@browserbasehq/stagehand";
import type { Competitor } from "../types.js";

export const competitor: Competitor = {
  name: "my-competitor",   // slug used in CLI flags and report
  label: "Display Name",   // shown in charts
  async createStagehand() {
    return new Stagehand({
      env: "LOCAL",
      localBrowserLaunchOptions: { wsEndpoint: process.env.MY_WS_URL },
      model: process.env.BENCHMARK_MODEL ?? "google/gemini-2.5-flash",
      modelClientOptions: { apiKey: process.env.GOOGLE_API_KEY },
      verbose: 0,
    } as ConstructorParameters<typeof Stagehand>[0]);
  },
};
```

## After any change

```bash
npm run build
```

Discovery runs against `dist/` — always rebuild before running.

## Running benchmarks

```bash
npm run benchmark                                        # all scenarios × all competitors
npm run benchmark -- --competitors browserbase          # filter by competitor name
npm run benchmark -- --scenarios basic-navigation       # filter by scenario name
npm run benchmark -- --local-only                       # local-chromium only
npm run benchmark -- --browser-only                     # skip LLM steps
npm run benchmark -- --sites https://... --runs 10
npm run report                                           # generate report.html
```

## Result schema

Results are `RunResult[]` in `results/<timestamp>.json`:
- `competitor` — competitor name
- `scenario` — scenario name
- `steps: Record<string, number>` — duration ms per step (always includes `init`)
- `total` — sum of all steps
- `metadata` — `{ host, sessionId, navigation, page }`

The report auto-adapts to whatever step names and competitors appear in the results.

## Key files

| File | Purpose |
|---|---|
| `src/runner.ts` | Execution engine + CLI entry point |
| `src/discover.ts` | Auto-discovers scenarios and competitors from `dist/` |
| `src/report.ts` | Generates report.html — adapts to any steps/competitors |
| `src/server.ts` | Dashboard server (`node dist/server.js`, port 3000) |
| `src/types.ts` | Core interfaces: `Scenario`, `Step`, `Competitor`, `RunResult` |
| `src/chromium.ts` | Resolves local Chromium binary path |
| `src/cost.ts` | TCO calculation for the cost section of reports |
