# EIN application workflow

Reference workflow for ein application workflow; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** reference.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/business-formation/ein-application/autobrowse/tasks/irs-ein-llc/playwright`.
- Languages: typescript.
- Frameworks: playwright.
- [Upstream setup and behavior](../../use-cases/business-formation/ein-application/README.md).
- [Dependency manifest `use-cases/business-formation/ein-application/autobrowse/tasks/irs-ein-llc/playwright/package.json`](../../use-cases/business-formation/ein-application/autobrowse/tasks/irs-ein-llc/playwright/package.json).
- [Source `use-cases/business-formation/ein-application/autobrowse/tasks/irs-ein-llc/playwright/irs-ein-llc.ts`](../../use-cases/business-formation/ein-application/autobrowse/tasks/irs-ein-llc/playwright/irs-ein-llc.ts).
- Original use-case taxonomy: business-formation.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/business-formation/ein-application/autobrowse/tasks/irs-ein-llc/playwright
npm ci
npm run typecheck
test -f .env || cp ../../../../.example.env .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/business-formation/ein-application/.example.env) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

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

Declared runtime dependencies from [use-cases/business-formation/ein-application/autobrowse/tasks/irs-ein-llc/playwright/package.json](../../use-cases/business-formation/ein-application/autobrowse/tasks/irs-ein-llc/playwright/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `dotenv` | `17.4.2` |
| `playwright` | `1.63.0` |
| `zod` | `4.5.4` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- The setup above covers the nested deterministic Playwright package. Copy the parent template into this package directory because dotenv loads .env from the working directory. The exploratory Autobrowse workflow has separate prerequisites in the upstream guide.
- The source invokes the bb CLI for cloud sessions; install and configure it separately. Local browser fallback requires an installed Playwright Chromium. CLI compatibility and live portal behavior remain unverified.
- This script operates on a real government portal. Review the inputs and stopping behavior before running; payment, submission and fallback findings remain open. Launch commands are documented, not executed by cookbook verification.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Forms and transactions](../topics/forms-and-transactions.md), [Business operations](../topics/business-operations.md).
