# LLC state filing

Reference workflow for llc state filing; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** reference.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/business-formation/llc-state-filing`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/business-formation/llc-state-filing/README.md).
- [Dependency manifest `use-cases/business-formation/llc-state-filing/package.json`](../../use-cases/business-formation/llc-state-filing/package.json).
- [Source `use-cases/business-formation/llc-state-filing/uc1-llc-formation.ts`](../../use-cases/business-formation/llc-state-filing/uc1-llc-formation.ts).
- Original use-case taxonomy: business-formation.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/business-formation/llc-state-filing
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/business-formation/llc-state-filing/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BIZFILE_PASSWORD` | Recipe configuration. Provides the bizfile password credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BIZFILE_USERNAME` | Recipe configuration. Provides the bizfile username credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/business-formation/llc-state-filing/package.json](../../use-cases/business-formation/llc-state-filing/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.0` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `dotenv` | `17.4.2` |
| `zod` | `4.5.4` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Forms and transactions](../topics/forms-and-transactions.md), [Business operations](../topics/business-operations.md).
