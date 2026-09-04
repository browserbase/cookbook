# Supplier Product Search

Private source-inspected example for supplier product search.

**Status:** legacy · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/commerce-and-market-intel/sample-01/supplier-product-search`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/commerce-and-market-intel/sample-01/supplier-product-search/README.md).
- [Dependency manifest `use-cases/commerce-and-market-intel/sample-01/supplier-product-search/package.json`](../../use-cases/commerce-and-market-intel/sample-01/supplier-product-search/package.json).
- [Source `use-cases/commerce-and-market-intel/sample-01/supplier-product-search/supplier-search-demo.ts`](../../use-cases/commerce-and-market-intel/sample-01/supplier-product-search/supplier-search-demo.ts).
- Original use-case taxonomy: commerce-and-market-intel.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/commerce-and-market-intel/sample-01/supplier-product-search
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run start
npm run demo
```

## Environment

[Environment template](../../use-cases/commerce-and-market-intel/sample-01/supplier-product-search/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | [Google AI](https://aistudio.google.com/apikey). Authenticates requests to Google AI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/commerce-and-market-intel/sample-01/supplier-product-search/package.json](../../use-cases/commerce-and-market-intel/sample-01/supplier-product-search/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@ai-sdk/openai` | `4.0.59` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `@types/node` | `26.4.1` |
| `ai` | `7.0.93` |
| `dotenv` | `17.4.2` |
| `tsx` | `4.23.13` |
| `typescript` | `7.0.2` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Legacy Stagehand dependency ^3.0.8; migration needed before claiming current SDK compatibility.
- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/commerce-and-market-intel/sample-01/supplier-product-search) at commit `0000000000000000000000000000000000000000`.

Related topics: [Extraction and research](../topics/extraction-and-research.md), [Agents and human handoff](../topics/agents-and-human-handoff.md), [Commerce and travel](../topics/commerce-and-travel.md).
