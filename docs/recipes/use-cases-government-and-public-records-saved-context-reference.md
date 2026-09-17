# Saved context reference

Reference workflow for saved context reference; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** reference.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/government-and-public-records/saved-context-reference`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/government-and-public-records/saved-context-reference/README.md).
- [Dependency manifest `use-cases/government-and-public-records/saved-context-reference/package.json`](../../use-cases/government-and-public-records/saved-context-reference/package.json).
- [Source `use-cases/government-and-public-records/saved-context-reference/index.ts`](../../use-cases/government-and-public-records/saved-context-reference/index.ts).
- Original use-case taxonomy: government-and-public-records.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/government-and-public-records/saved-context-reference
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/government-and-public-records/saved-context-reference/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

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

Declared runtime dependencies from [use-cases/government-and-public-records/saved-context-reference/package.json](../../use-cases/government-and-public-records/saved-context-reference/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `dotenv` | `17.4.2` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Authentication and saved sessions](../topics/authentication.md), [Extraction and research](../topics/extraction-and-research.md), [Testing and observability](../topics/testing-and-observability.md), [Business operations](../topics/business-operations.md).
