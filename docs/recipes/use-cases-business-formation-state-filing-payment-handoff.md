# State filing payment handoff

Reference workflow for state filing payment handoff; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** reference.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/business-formation/state-filing-payment-handoff/autobrowse/tasks/bizfile-ca-llc/playwright`.
- Languages: shell, typescript.
- Frameworks: playwright.
- [Upstream setup and behavior](../../use-cases/business-formation/state-filing-payment-handoff/README.md).
- [Dependency manifest `use-cases/business-formation/state-filing-payment-handoff/autobrowse/tasks/bizfile-ca-llc/playwright/package.json`](../../use-cases/business-formation/state-filing-payment-handoff/autobrowse/tasks/bizfile-ca-llc/playwright/package.json).
- [Source `use-cases/business-formation/state-filing-payment-handoff/autobrowse/tasks/bizfile-ca-llc/playwright/bizfile-ca-llc.ts`](../../use-cases/business-formation/state-filing-payment-handoff/autobrowse/tasks/bizfile-ca-llc/playwright/bizfile-ca-llc.ts).
- Original use-case taxonomy: business-formation.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/business-formation/state-filing-payment-handoff/autobrowse/tasks/bizfile-ca-llc/playwright
npm ci
npm run typecheck
test -f .env || cp ../../../../.env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/business-formation/state-filing-payment-handoff/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BIZFILE_PASS` | Recipe configuration. Provides the bizfile pass credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_CONTEXT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects a saved browser context for this workflow. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BROWSERBASE_SESSION_ID` | [Browserbase](https://www.browserbase.com/settings). Configures browserbase session id behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `PAYMENT_CARD_CVV` | Recipe configuration. Provides the payment card cvv credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `PAYMENT_CARD_NUMBER` | Recipe configuration. Provides the payment card number credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BIZFILE_ALLOW_PAYMENT_HANDOFF` | Recipe configuration. Configures bizfile allow payment handoff behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BIZFILE_USER` | Recipe configuration. Configures bizfile user behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `LLC_AGENT_CITY` | Recipe configuration. Configures llc agent city behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `LLC_AGENT_FIRST_NAME` | Recipe configuration. Configures llc agent first name behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `LLC_AGENT_LAST_NAME` | Recipe configuration. Configures llc agent last name behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `LLC_AGENT_STATE` | Recipe configuration. Configures llc agent state behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `LLC_AGENT_STREET` | Recipe configuration. Configures llc agent street behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `LLC_AGENT_ZIP` | Recipe configuration. Configures llc agent zip behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `LLC_MAILING_CITY` | Recipe configuration. Configures llc mailing city behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `LLC_MAILING_STATE` | Recipe configuration. Configures llc mailing state behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `LLC_MAILING_STREET` | Recipe configuration. Configures llc mailing street behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `LLC_MAILING_ZIP` | Recipe configuration. Configures llc mailing zip behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `LLC_MANAGEMENT_STRUCTURE` | Recipe configuration. Configures llc management structure behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `LLC_NAME` | Recipe configuration. Configures llc name behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `LLC_ORGANIZER_NAME` | Recipe configuration. Configures llc organizer name behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `LLC_PRINCIPAL_CITY` | Recipe configuration. Configures llc principal city behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `LLC_PRINCIPAL_STATE` | Recipe configuration. Configures llc principal state behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `LLC_PRINCIPAL_STREET` | Recipe configuration. Configures llc principal street behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `LLC_PRINCIPAL_ZIP` | Recipe configuration. Configures llc principal zip behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `PAYMENT_BILLING_ADDRESS` | Recipe configuration. Configures payment billing address behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `PAYMENT_BILLING_CITY` | Recipe configuration. Configures payment billing city behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `PAYMENT_BILLING_STATE` | Recipe configuration. Configures payment billing state behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `PAYMENT_BILLING_ZIP` | Recipe configuration. Configures payment billing zip behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `PAYMENT_CARDHOLDER_NAME` | Recipe configuration. Configures payment cardholder name behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `PAYMENT_CARD_EXP_MONTH` | Recipe configuration. Configures payment card exp month behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `PAYMENT_CARD_EXP_YEAR` | Recipe configuration. Configures payment card exp year behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/business-formation/state-filing-payment-handoff/autobrowse/tasks/bizfile-ca-llc/playwright/package.json](../../use-cases/business-formation/state-filing-payment-handoff/autobrowse/tasks/bizfile-ca-llc/playwright/package.json). Alternate manifests may differ; use the documented setup path.

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

Related topics: [Forms and transactions](../topics/forms-and-transactions.md), [Agents and human handoff](../topics/agents-and-human-handoff.md), [Testing and observability](../topics/testing-and-observability.md), [Business operations](../topics/business-operations.md).
