# Flight Pricing Benchmark

Private source-inspected example for flight pricing benchmark.

**Status:** legacy · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/travel-and-hospitality/sample-02/flight-pricing-benchmark`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/travel-and-hospitality/sample-02/flight-pricing-benchmark/README.md).
- [Dependency manifest `use-cases/travel-and-hospitality/sample-02/flight-pricing-benchmark/package.json`](../../use-cases/travel-and-hospitality/sample-02/flight-pricing-benchmark/package.json).
- [Source `use-cases/travel-and-hospitality/sample-02/flight-pricing-benchmark/index.ts`](../../use-cases/travel-and-hospitality/sample-02/flight-pricing-benchmark/index.ts).
- Original use-case taxonomy: travel-and-hospitality.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/travel-and-hospitality/sample-02/flight-pricing-benchmark
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run dev
npm run demo
```

## Environment

[Environment template](../../use-cases/travel-and-hospitality/sample-02/flight-pricing-benchmark/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `GOOGLE_API_KEY` | [Google AI](https://aistudio.google.com/apikey). Authenticates requests to Google AI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `MODEL_API_KEY` | Recipe configuration. Authenticates requests to Recipe configuration. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `TRAVEL_PORTAL_CONTEXT_ID` | Recipe configuration. Selects a saved browser context for this workflow. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TRAVEL_PORTAL_EMAIL` | Recipe configuration. Provides the travel portal email credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `TRAVEL_PORTAL_PASSWORD` | Recipe configuration. Provides the travel portal password credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `AGENT_MODEL` | Recipe configuration. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BENCHMARK_DEPARTURE_DATE` | Recipe configuration. Configures benchmark departure date behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `MODEL_NAME` | Recipe configuration. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TRAVEL_PORTAL_AGENT_SCREENSHOTS` | Recipe configuration. Configures travel portal agent screenshots behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `STAGEHAND_EXECUTION_MODEL` | Stagehand. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/travel-and-hospitality/sample-02/flight-pricing-benchmark/package.json](../../use-cases/travel-and-hospitality/sample-02/flight-pricing-benchmark/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@ai-sdk/openai` | `4.0.53` |
| `@browserbasehq/sdk` | `2.19.0` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `ai` | `7.0.87` |
| `dotenv` | `17.4.2` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Legacy Stagehand dependency ^2.1.0; migration needed before claiming current SDK compatibility.
- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/travel-and-hospitality/sample-02/flight-pricing-benchmark) at commit `0000000000000000000000000000000000000000`.

Related topics: [Testing and observability](../topics/testing-and-observability.md), [Commerce and travel](../topics/commerce-and-travel.md).
