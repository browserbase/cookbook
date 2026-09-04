# Context Test

Private source-inspected example for context test.

**Status:** current · private · source inspected.

**Recipe type:** reusable snippet.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/government-and-public-records/sample-04/context-test`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/government-and-public-records/sample-04/context-test/README.md).
- [Dependency manifest `use-cases/government-and-public-records/sample-04/context-test/package.json`](../../use-cases/government-and-public-records/sample-04/context-test/package.json).
- [Source `use-cases/government-and-public-records/sample-04/context-test/index.ts`](../../use-cases/government-and-public-records/sample-04/context-test/index.ts).
- Original use-case taxonomy: government-and-public-records.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/government-and-public-records/sample-04/context-test
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/government-and-public-records/sample-04/context-test/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_CONTEXT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects a saved browser context for this workflow. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BB_REGION` | [Browserbase](https://www.browserbase.com/settings). Configures bb region behavior for this recipe. Non-secret. | `us-west-2` | Use the format described by the recipe. No default. |
| `MODEL` | Recipe configuration. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `NAV_TIMEOUT_MS` | Recipe configuration. Configures nav timeout ms behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `OS_FINGERPRINT` | Recipe configuration. Configures os fingerprint behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `PROXY_COUNTRY` | Recipe configuration. Configures proxy country behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `PROXY_STATE` | Recipe configuration. Configures proxy state behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `SETTLE_MS` | Recipe configuration. Configures settle ms behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `SETUP_SESSION_TIMEOUT_S` | Recipe configuration. Configures setup session timeout s behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/government-and-public-records/sample-04/context-test/package.json](../../use-cases/government-and-public-records/sample-04/context-test/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `dotenv` | `17.4.2` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/government-and-public-records/sample-04/context-test) at commit `0000000000000000000000000000000000000000`.

Related topics: [Authentication and saved sessions](../topics/authentication.md), [Extraction and research](../topics/extraction-and-research.md), [Testing and observability](../topics/testing-and-observability.md), [Business operations](../topics/business-operations.md).
