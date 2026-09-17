# ERP payment form

Reference workflow for erp payment form; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/commerce-and-market-intel/erp-payment-form`.
- Languages: typescript.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../use-cases/commerce-and-market-intel/erp-payment-form/README.md).
- [Dependency manifest `use-cases/commerce-and-market-intel/erp-payment-form/package.json`](../../use-cases/commerce-and-market-intel/erp-payment-form/package.json).
- [Source `use-cases/commerce-and-market-intel/erp-payment-form/main.ts`](../../use-cases/commerce-and-market-intel/erp-payment-form/main.ts).
- Original use-case taxonomy: commerce-and-market-intel.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/commerce-and-market-intel/erp-payment-form
npm install
npm run typecheck
cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm start
```

## Environment

[Environment template](../../use-cases/commerce-and-market-intel/erp-payment-form/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ERP_USERNAME` | Recipe configuration. Provides the ERP username credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `ERP_PASSWORD` | Recipe configuration. Provides the ERP password credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ERP_LOGIN_URL` | Recipe configuration. Configures the ERP login url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |
| `ERP_PAYMENT_URL` | Recipe configuration. Configures the ERP payment url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |
| `PAYMENT_DATA_PATH` | Recipe configuration. Configures payment data path behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/commerce-and-market-intel/erp-payment-form/package.json](../../use-cases/commerce-and-market-intel/erp-payment-form/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.0` |
| `dotenv` | `17.4.2` |
| `playwright-core` | `1.62.1` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- The new local package uses the cookbook migration dependency versions. Scripts run live account workflows and still need source-specific configuration; package installation/typechecking alone does not verify those workflows.
- Performs payment submission; no validated confirmation or safe draft handoff is established by the current source.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Forms and transactions](../topics/forms-and-transactions.md), [Business operations](../topics/business-operations.md).
