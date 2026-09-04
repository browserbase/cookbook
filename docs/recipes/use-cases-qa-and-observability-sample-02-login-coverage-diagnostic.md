# Login Coverage Diagnostic

Private source-inspected example for login coverage diagnostic.

**Status:** current · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/qa-and-observability/sample-02/login-coverage-diagnostic`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/qa-and-observability/sample-02/login-coverage-diagnostic/README.md).
- [Dependency manifest `use-cases/qa-and-observability/sample-02/login-coverage-diagnostic/package.json`](../../use-cases/qa-and-observability/sample-02/login-coverage-diagnostic/package.json).
- [Source `use-cases/qa-and-observability/sample-02/login-coverage-diagnostic/run.ts`](../../use-cases/qa-and-observability/sample-02/login-coverage-diagnostic/run.ts).
- Original use-case taxonomy: qa-and-observability.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/qa-and-observability/sample-02/login-coverage-diagnostic
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run start
```

## Environment

[Environment template](../../use-cases/qa-and-observability/sample-02/login-coverage-diagnostic/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `AESTHETICRECORD_PASSWORD` | Recipe configuration. Provides the aestheticrecord password credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `AESTHETICRECORD_USERNAME` | Recipe configuration. Provides the aestheticrecord username credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_CONTEXT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects a saved browser context for this workflow. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `FEDEX_PASSWORD` | Recipe configuration. Provides the fedex password credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `FEDEX_USERNAME` | Recipe configuration. Provides the fedex username credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `OPENTABLE_PASSWORD` | Recipe configuration. Provides the opentable password credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `OPENTABLE_USERNAME` | Recipe configuration. Provides the opentable username credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `SITEDISH_PASSWORD` | Recipe configuration. Provides the sitedish password credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `SITEDISH_USERNAME` | Recipe configuration. Provides the sitedish username credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `RETRIES` | Recipe configuration. Configures retries behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `SOLVE_WAIT_MS` | Recipe configuration. Configures solve wait ms behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/qa-and-observability/sample-02/login-coverage-diagnostic/package.json](../../use-cases/qa-and-observability/sample-02/login-coverage-diagnostic/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/stagehand` | `4.0.2` |
| `dotenv` | `17.4.2` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/qa-and-observability/sample-02/login-coverage-diagnostic) at commit `0000000000000000000000000000000000000000`.

Related topics: [Authentication and saved sessions](../topics/authentication.md), [Testing and observability](../topics/testing-and-observability.md).
