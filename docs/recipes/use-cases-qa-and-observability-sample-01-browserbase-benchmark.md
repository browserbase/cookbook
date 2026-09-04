# Browserbase Benchmark

Private source-inspected example for browserbase benchmark.

**Status:** current · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/qa-and-observability/sample-01/browserbase-benchmark/browserbase-benchmark`.
- Languages: shell, typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/qa-and-observability/sample-01/browserbase-benchmark/browserbase-benchmark/README.md).
- [Dependency manifest `use-cases/qa-and-observability/sample-01/browserbase-benchmark/browserbase-benchmark/package.json`](../../use-cases/qa-and-observability/sample-01/browserbase-benchmark/browserbase-benchmark/package.json).
- [Source `use-cases/qa-and-observability/sample-01/browserbase-benchmark/browserbase-benchmark/src/runner.ts`](../../use-cases/qa-and-observability/sample-01/browserbase-benchmark/browserbase-benchmark/src/runner.ts).
- [Source `use-cases/qa-and-observability/sample-01/browserbase-benchmark/browserbase-benchmark/src/server.ts`](../../use-cases/qa-and-observability/sample-01/browserbase-benchmark/browserbase-benchmark/src/server.ts).
- [Source `use-cases/qa-and-observability/sample-01/browserbase-benchmark/browserbase-benchmark/src/report.ts`](../../use-cases/qa-and-observability/sample-01/browserbase-benchmark/browserbase-benchmark/src/report.ts).
- Original use-case taxonomy: qa-and-observability.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/qa-and-observability/sample-01/browserbase-benchmark/browserbase-benchmark
npm install
npm run build
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run benchmark:browser
npm run report
```

## Environment

[Environment template](../../use-cases/qa-and-observability/sample-01/browserbase-benchmark/browserbase-benchmark/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BENCHMARK_ACCESS_TOKEN` | Recipe configuration. Provides the benchmark access token credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `GOOGLE_API_KEY` | [Google AI](https://aistudio.google.com/apikey). Authenticates requests to Google AI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `AVG_SESSION_MINUTES` | Recipe configuration. Configures avg session minutes behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `BENCHMARK_HOST` | Recipe configuration. Configures benchmark host behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BENCHMARK_MODEL` | Recipe configuration. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BENCHMARK_PUBLIC_ORIGIN` | Recipe configuration. Configures benchmark public origin behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BENCHMARK_RUNS` | Recipe configuration. Configures benchmark runs behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BENCHMARK_SITES` | Recipe configuration. Configures benchmark sites behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BROWSERBASE_REGION` | [Browserbase](https://www.browserbase.com/settings). Configures browserbase region behavior for this recipe. Non-secret. | `us-west-2` | Use the format described by the recipe. No default. |
| `BROWSER_ONLY` | Recipe configuration. Configures browser only behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `HOME` | Recipe configuration. Configures home behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `LOCAL_CHROMIUM_EXECUTABLE` | Recipe configuration. Configures local chromium executable behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `OPS_HOURS` | Recipe configuration. Configures ops hours behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `PLAYWRIGHT_BROWSERS_PATH` | Recipe configuration. Configures playwright browsers path behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `PORT` | Recipe configuration. Configures port behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `SESSIONS_PER_DAY` | Recipe configuration. Configures sessions per day behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/qa-and-observability/sample-01/browserbase-benchmark/browserbase-benchmark/package.json](../../use-cases/qa-and-observability/sample-01/browserbase-benchmark/browserbase-benchmark/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@anthropic-ai/sdk` | `0.124.0` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.
- Node.js >=22 is declared by the package. Install a local Chromium browser for the local competitor; see the package README.
- npm run benchmark:browser skips model steps but creates browser sessions. Local build and synthetic regression tests pass; live benchmark execution is unverified.
- The HTTP dashboard/API require BENCHMARK_ACCESS_TOKEN; configure BENCHMARK_PUBLIC_ORIGIN for browser control requests and HTTPS for remote access. Only /health is public. See source README for Basic/Bearer authentication.
- Use Node 24.19.0. Local, Render, and EC2 runtime declarations agree; clean-install and deployment validation remain pending.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/qa-and-observability/sample-01/browserbase-benchmark) at commit `0000000000000000000000000000000000000000`.

Related topics: [Testing and observability](../topics/testing-and-observability.md).
