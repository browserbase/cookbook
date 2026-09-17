# Browser trace

Reference workflow for browser trace; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** reference.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/qa-and-observability/browser-trace`.
- Languages: javascript.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../use-cases/qa-and-observability/browser-trace/README.md).
- [Dependency manifest `use-cases/qa-and-observability/browser-trace/package.json`](../../use-cases/qa-and-observability/browser-trace/package.json).
- [Source `use-cases/qa-and-observability/browser-trace/record-and-fix/server.mjs`](../../use-cases/qa-and-observability/browser-trace/record-and-fix/server.mjs).
- [Source `use-cases/qa-and-observability/browser-trace/runtime-demo/capture-trace.mjs`](../../use-cases/qa-and-observability/browser-trace/runtime-demo/capture-trace.mjs).
- [Source `use-cases/qa-and-observability/browser-trace/runtime-demo/capture.mjs`](../../use-cases/qa-and-observability/browser-trace/runtime-demo/capture.mjs).
- [Source `use-cases/qa-and-observability/browser-trace/eval/run-eval.mjs`](../../use-cases/qa-and-observability/browser-trace/eval/run-eval.mjs).
- Original use-case taxonomy: qa-and-observability.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/qa-and-observability/browser-trace
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/qa-and-observability/browser-trace/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `GROQ_API_KEY` | Recipe configuration. Authenticates requests to Recipe configuration. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `APP_NAME` | Recipe configuration. Configures app name behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `APP_URL` | Recipe configuration. Configures the app url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |
| `BROWSER_TRACE_DIR` | Recipe configuration. Configures browser trace dir behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `FIX_URL` | Recipe configuration. Configures the fix url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |
| `PORT` | Recipe configuration. Configures port behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `RECORD_ONLY` | Recipe configuration. Configures record only behavior for this recipe. Non-secret. | `false` | Use the format described by the recipe. No default. |
| `REPO_ROOT` | Recipe configuration. Configures repo root behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `VH` | Recipe configuration. Configures vh behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `VW` | Recipe configuration. Configures vw behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/qa-and-observability/browser-trace/package.json](../../use-cases/qa-and-observability/browser-trace/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.0` |
| `playwright-core` | `1.62.1` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Testing and observability](../topics/testing-and-observability.md).
