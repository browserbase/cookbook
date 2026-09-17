# Real estate research agent

Reference workflow for real estate research agent; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** legacy · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/sales-support-and-ops/real-estate-research`.
- Languages: javascript, typescript.
- Frameworks: @browserbasehq/stagehand, next.
- [Upstream setup and behavior](../../use-cases/sales-support-and-ops/real-estate-research/README.md).
- [Dependency manifest `use-cases/sales-support-and-ops/real-estate-research/package.json`](../../use-cases/sales-support-and-ops/real-estate-research/package.json).
- [Source `use-cases/sales-support-and-ops/real-estate-research/src/app/api/browse/route.ts`](../../use-cases/sales-support-and-ops/real-estate-research/src/app/api/browse/route.ts).
- Original use-case taxonomy: sales-support-and-ops.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/sales-support-and-ops/real-estate-research
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run dev
npm run start
```

## Environment

[Environment template](../../use-cases/sales-support-and-ops/real-estate-research/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/sales-support-and-ops/real-estate-research/package.json](../../use-cases/sales-support-and-ops/real-estate-research/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@ai-sdk/openai` | `4.0.52` |
| `@browserbasehq/sdk` | `2.19.0` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `@tailwindcss/postcss` | `4.3.3` |
| `@types/node` | `26.4.0` |
| `@types/react` | `19.2.18` |
| `ai` | `7.0.86` |
| `dotenv` | `17.4.2` |
| `next` | `16.3.3` |
| `postcss` | `8.5.26` |
| `react` | `19.2.8` |
| `react-dom` | `19.2.8` |
| `tailwindcss` | `4.3.3` |
| `typescript` | `7.0.2` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Legacy Stagehand dependency ^3.1.0; migration needed before claiming current SDK compatibility.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Business operations](../topics/business-operations.md).
