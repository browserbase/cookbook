# Property tax document workflow

Reference workflow for property tax document workflow; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** legacy · source inspected.

**Recipe type:** reference.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/accounts-payable-and-finance/property-tax-document`.
- Languages: javascript, shell, typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/accounts-payable-and-finance/property-tax-document/README.md).
- [Dependency manifest `use-cases/accounts-payable-and-finance/property-tax-document/package.json`](../../use-cases/accounts-payable-and-finance/property-tax-document/package.json).
- [Source `use-cases/accounts-payable-and-finance/property-tax-document/stagehand/fetch-bill.ts`](../../use-cases/accounts-payable-and-finance/property-tax-document/stagehand/fetch-bill.ts).
- [Source `use-cases/accounts-payable-and-finance/property-tax-document/stagehand/fetch-bill-agent.ts`](../../use-cases/accounts-payable-and-finance/property-tax-document/stagehand/fetch-bill-agent.ts).
- [Source `use-cases/accounts-payable-and-finance/property-tax-document/upload-bill.mjs`](../../use-cases/accounts-payable-and-finance/property-tax-document/upload-bill.mjs).
- Original use-case taxonomy: accounts-payable-and-finance.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/accounts-payable-and-finance/property-tax-document
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/accounts-payable-and-finance/property-tax-document/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `AP_ACCESS_TOKEN` | target service. Provides the target service access token credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `AP_CLIENT_SECRET` | target service. Provides the target service client secret credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `HOME` | Recipe configuration. Configures home behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `AP_ALLOW_SUBMIT_BILL` | target service. Configures target service allow submit bill behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `AP_BILL_MODE` | target service. Configures target service bill mode behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `AP_CLIENT_ID` | target service. Configures target service client id behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `AP_ENV` | target service. Configures target service env behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `STAGEHAND_MODEL` | Stagehand. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/accounts-payable-and-finance/property-tax-document/package.json](../../use-cases/accounts-payable-and-finance/property-tax-document/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@ai-sdk/openai` | `4.0.53` |
| `@browserbasehq/sdk` | `2.19.0` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `ai` | `7.0.87` |
| `zod` | `4.5.4` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Legacy Stagehand dependency ^2.4.0; migration needed before claiming current SDK compatibility.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Business operations](../topics/business-operations.md).
