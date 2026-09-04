# Irs Ein

Private source-inspected example for irs ein.

**Status:** current · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/business-formation/sample-01/irs-ein/autobrowse/tasks/irs-ein-llc/playwright`.
- Languages: typescript.
- Frameworks: playwright.
- [Upstream setup and behavior](../../use-cases/business-formation/sample-01/irs-ein/README.md).
- [Dependency manifest `use-cases/business-formation/sample-01/irs-ein/autobrowse/tasks/irs-ein-llc/playwright/package.json`](../../use-cases/business-formation/sample-01/irs-ein/autobrowse/tasks/irs-ein-llc/playwright/package.json).
- [Source `use-cases/business-formation/sample-01/irs-ein/autobrowse/tasks/irs-ein-llc/playwright/irs-ein-llc.ts`](../../use-cases/business-formation/sample-01/irs-ein/autobrowse/tasks/irs-ein-llc/playwright/irs-ein-llc.ts).
- Original use-case taxonomy: business-formation.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/business-formation/sample-01/irs-ein/autobrowse/tasks/irs-ein-llc/playwright
npm ci
npm run typecheck
test -f .env || cp ../../../../.example.env .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm start
```

## Environment

[Environment template](../../use-cases/business-formation/sample-01/irs-ein/.example.env) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `EIN_RESPONSIBLE_SSN` | Recipe configuration. Provides the ein responsible ssn credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `EIN_ADDRESS_LINE1` | Recipe configuration. Configures ein address line1 behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `EIN_BUSINESS_NAME` | Recipe configuration. Configures ein business name behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `EIN_CITY` | Recipe configuration. Configures ein city behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `EIN_COUNTY` | Recipe configuration. Configures ein county behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `EIN_PHONE` | Recipe configuration. Configures ein phone behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `EIN_RESPONSIBLE_FIRST_NAME` | Recipe configuration. Configures ein responsible first name behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `EIN_RESPONSIBLE_LAST_NAME` | Recipe configuration. Configures ein responsible last name behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `EIN_STATE` | Recipe configuration. Configures ein state behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `EIN_ZIP` | Recipe configuration. Configures ein zip behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/business-formation/sample-01/irs-ein/autobrowse/tasks/irs-ein-llc/playwright/package.json](../../use-cases/business-formation/sample-01/irs-ein/autobrowse/tasks/irs-ein-llc/playwright/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `dotenv` | `17.4.2` |
| `playwright` | `1.63.0` |
| `zod` | `4.5.4` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.
- The setup above covers the nested deterministic Playwright package. Copy the parent template into this package directory because dotenv loads .env from the working directory. The exploratory Autobrowse workflow has separate prerequisites in the upstream guide.
- The source invokes the bb CLI for cloud sessions; install and configure it separately. Local browser fallback requires an installed Playwright Chromium. CLI compatibility and live portal behavior remain unverified.
- This script operates on a real government portal. Review the inputs and stopping behavior before running; payment, submission and fallback findings remain open. Launch commands are documented, not executed by cookbook verification.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/business-formation/sample-01/irs-ein) at commit `0000000000000000000000000000000000000000`.

Related topics: [Forms and transactions](../topics/forms-and-transactions.md), [Business operations](../topics/business-operations.md).
