# Multi-portal login coverage reference

Reference workflow for multi-portal login coverage reference; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** reference.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/qa-and-observability/login-coverage`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/qa-and-observability/login-coverage/README.md).
- [Dependency manifest `use-cases/qa-and-observability/login-coverage/package.json`](../../use-cases/qa-and-observability/login-coverage/package.json).
- [Source `use-cases/qa-and-observability/login-coverage/run.ts`](../../use-cases/qa-and-observability/login-coverage/run.ts).
- Original use-case taxonomy: qa-and-observability.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/qa-and-observability/login-coverage
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/qa-and-observability/login-coverage/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `AESTHETICRECORD_PASSWORD` | Recipe configuration. Provides the aestheticrecord password credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `AESTHETICRECORD_USERNAME` | Recipe configuration. Provides the aestheticrecord username credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_CONTEXT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects a saved browser context for this workflow. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `PORTAL_A_PASSWORD` | Recipe configuration. Provides the portal A password credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `PORTAL_A_USERNAME` | Recipe configuration. Provides the portal A username credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `PORTAL_B_PASSWORD` | Recipe configuration. Provides the portal B password credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `PORTAL_B_USERNAME` | Recipe configuration. Provides the portal B username credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `PORTAL_D_PASSWORD` | Recipe configuration. Provides the portal D password credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `PORTAL_D_USERNAME` | Recipe configuration. Provides the portal D username credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `RETRIES` | Recipe configuration. Configures retries behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `SOLVE_WAIT_MS` | Recipe configuration. Configures solve wait ms behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/qa-and-observability/login-coverage/package.json](../../use-cases/qa-and-observability/login-coverage/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/stagehand` | `4.0.2` |
| `dotenv` | `17.4.2` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Authentication and saved sessions](../topics/authentication.md), [Testing and observability](../topics/testing-and-observability.md).
