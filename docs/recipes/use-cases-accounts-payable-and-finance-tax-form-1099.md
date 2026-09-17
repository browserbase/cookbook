# 1099 tax form workflow

Reference workflow for 1099 tax form workflow; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** reference.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/accounts-payable-and-finance/tax-form-1099`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/accounts-payable-and-finance/tax-form-1099/README.md).
- [Dependency manifest `use-cases/accounts-payable-and-finance/tax-form-1099/package.json`](../../use-cases/accounts-payable-and-finance/tax-form-1099/package.json).
- [Source `use-cases/accounts-payable-and-finance/tax-form-1099/index.ts`](../../use-cases/accounts-payable-and-finance/tax-form-1099/index.ts).
- Original use-case taxonomy: accounts-payable-and-finance.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/accounts-payable-and-finance/tax-form-1099
npm install
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/accounts-payable-and-finance/tax-form-1099/package.json](../../use-cases/accounts-payable-and-finance/tax-form-1099/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/stagehand` | `4.0.2` |
| `zod` | `4.5.4` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Business operations](../topics/business-operations.md).
