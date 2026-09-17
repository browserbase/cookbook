# Synthetic treasury workflow

Reference workflow for synthetic treasury workflow; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** legacy · source inspected.

**Recipe type:** reference.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/accounts-payable-and-finance/treasury-workflow`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/accounts-payable-and-finance/treasury-workflow/README.md).
- [Dependency manifest `use-cases/accounts-payable-and-finance/treasury-workflow/package.json`](../../use-cases/accounts-payable-and-finance/treasury-workflow/package.json).
- [Source `use-cases/accounts-payable-and-finance/treasury-workflow/index.ts`](../../use-cases/accounts-payable-and-finance/treasury-workflow/index.ts).
- [Source `use-cases/accounts-payable-and-finance/treasury-workflow/serve.ts`](../../use-cases/accounts-payable-and-finance/treasury-workflow/serve.ts).
- Original use-case taxonomy: accounts-payable-and-finance.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/accounts-payable-and-finance/treasury-workflow
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/accounts-payable-and-finance/treasury-workflow/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BANK_PASSWORD` | Recipe configuration. Provides the bank password credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BANK_USERNAME` | Recipe configuration. Provides the bank username credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `GOOGLE_API_KEY` | [Google AI](https://aistudio.google.com/apikey). Authenticates requests to Google AI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `MODEL_API_KEY` | Recipe configuration. Authenticates requests to Recipe configuration. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BANK_PORTAL_URL` | Recipe configuration. Configures the bank portal url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |
| `MODEL_NAME` | Recipe configuration. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TREASURY_PORTAL_URL` | Recipe configuration. Configures the treasury portal url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/accounts-payable-and-finance/treasury-workflow/package.json](../../use-cases/accounts-payable-and-finance/treasury-workflow/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `dotenv` | `17.4.2` |
| `playwright-core` | `1.63.0` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Legacy Stagehand dependency ^2.1.0; migration needed before claiming current SDK compatibility.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Files and documents](../topics/downloads-and-documents.md), [Business operations](../topics/business-operations.md).
