# Restaurant reservation function

Reference workflow for restaurant reservation function; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** reusable snippet.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/sales-support-and-ops/restaurant-reservation`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/sales-support-and-ops/restaurant-reservation/README.md).
- [Dependency manifest `use-cases/sales-support-and-ops/restaurant-reservation/package.json`](../../use-cases/sales-support-and-ops/restaurant-reservation/package.json).
- [Source `use-cases/sales-support-and-ops/restaurant-reservation/index.ts`](../../use-cases/sales-support-and-ops/restaurant-reservation/index.ts).
- Original use-case taxonomy: sales-support-and-ops.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/sales-support-and-ops/restaurant-reservation
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/sales-support-and-ops/restaurant-reservation/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `MODEL_API_KEY` | Recipe configuration. Authenticates requests to Recipe configuration. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/sales-support-and-ops/restaurant-reservation/package.json](../../use-cases/sales-support-and-ops/restaurant-reservation/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@ai-sdk/openai` | `4.0.59` |
| `@browserbasehq/sdk-functions` | `1.0.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `ai` | `7.0.93` |
| `playwright-core` | `1.63.0` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Extraction and research](../topics/extraction-and-research.md), [Forms and transactions](../topics/forms-and-transactions.md), [Business operations](../topics/business-operations.md).
