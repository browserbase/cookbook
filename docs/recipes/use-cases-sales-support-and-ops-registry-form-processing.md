# Registry form processing

Reference workflow for registry form processing; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/sales-support-and-ops/registry-form-processing`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/sales-support-and-ops/registry-form-processing/README.md).
- [Dependency manifest `use-cases/sales-support-and-ops/registry-form-processing/package.json`](../../use-cases/sales-support-and-ops/registry-form-processing/package.json).
- [Source `use-cases/sales-support-and-ops/registry-form-processing/index.ts`](../../use-cases/sales-support-and-ops/registry-form-processing/index.ts).
- Original use-case taxonomy: sales-support-and-ops.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/sales-support-and-ops/registry-form-processing
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run start
```

## Environment

[Environment template](../../use-cases/sales-support-and-ops/registry-form-processing/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/sales-support-and-ops/registry-form-processing/package.json](../../use-cases/sales-support-and-ops/registry-form-processing/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `@playwright/test` | `1.63.0` |
| `boxen` | `8.0.1` |
| `chalk` | `6.0.0` |
| `dotenv` | `17.4.2` |
| `fast-csv` | `5.0.7` |
| `openai` | `7.10.0` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Current config uses Local Chrome with a visible window and openai/gpt-4o with OPENAI_API_KEY; see the recipe README for launcher and model edits. Runtime is not verified.
- Field processing uses a separate OpenAI client and still requires OPENAI_API_KEY after a Stagehand provider change.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Business operations](../topics/business-operations.md).
