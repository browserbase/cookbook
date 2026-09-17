# Postal evidence reference

Reference workflow for postal evidence reference; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** legacy · source inspected.

**Recipe type:** reference.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/accounts-payable-and-finance/postal-evidence-reference`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/accounts-payable-and-finance/postal-evidence-reference/README.md).
- [Dependency manifest `use-cases/accounts-payable-and-finance/postal-evidence-reference/package.json`](../../use-cases/accounts-payable-and-finance/postal-evidence-reference/package.json).
- [Source `use-cases/accounts-payable-and-finance/postal-evidence-reference/src/cli.ts`](../../use-cases/accounts-payable-and-finance/postal-evidence-reference/src/cli.ts).
- Original use-case taxonomy: accounts-payable-and-finance.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/accounts-payable-and-finance/postal-evidence-reference
npm install
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `EXTERNAL_PROXY` | Recipe configuration. Configures external proxy behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/accounts-payable-and-finance/postal-evidence-reference/package.json](../../use-cases/accounts-payable-and-finance/postal-evidence-reference/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/stagehand` | `4.0.2` |
| `@types/node` | `26.4.1` |
| `pdf-lib` | `1.17.1` |
| `playwright-core` | `1.63.0` |
| `tsx` | `4.23.13` |
| `typescript` | `7.0.2` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Legacy Stagehand dependency ^3.6.0; migration needed before claiming current SDK compatibility.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Business operations](../topics/business-operations.md).
