# Browser Trace

Private source-inspected example for browser trace.

**Status:** current · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/qa-and-observability/sample-03/browser-trace`.
- Languages: javascript.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../use-cases/qa-and-observability/sample-03/browser-trace/README.md).
- [Dependency manifest `use-cases/qa-and-observability/sample-03/browser-trace/package.json`](../../use-cases/qa-and-observability/sample-03/browser-trace/package.json).
- [Source `use-cases/qa-and-observability/sample-03/browser-trace/record-and-fix/server.mjs`](../../use-cases/qa-and-observability/sample-03/browser-trace/record-and-fix/server.mjs).
- [Source `use-cases/qa-and-observability/sample-03/browser-trace/runtime-demo/capture-trace.mjs`](../../use-cases/qa-and-observability/sample-03/browser-trace/runtime-demo/capture-trace.mjs).
- [Source `use-cases/qa-and-observability/sample-03/browser-trace/runtime-demo/capture.mjs`](../../use-cases/qa-and-observability/sample-03/browser-trace/runtime-demo/capture.mjs).
- [Source `use-cases/qa-and-observability/sample-03/browser-trace/eval/run-eval.mjs`](../../use-cases/qa-and-observability/sample-03/browser-trace/eval/run-eval.mjs).
- Original use-case taxonomy: qa-and-observability.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/qa-and-observability/sample-03/browser-trace
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run demo
```

## Environment

[Environment template](../../use-cases/qa-and-observability/sample-03/browser-trace/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

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

Declared runtime dependencies from [use-cases/qa-and-observability/sample-03/browser-trace/package.json](../../use-cases/qa-and-observability/sample-03/browser-trace/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.0` |
| `playwright-core` | `1.62.1` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/qa-and-observability/sample-03/browser-trace) at commit `0000000000000000000000000000000000000000`.

Related topics: [Testing and observability](../topics/testing-and-observability.md).
