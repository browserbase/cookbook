# Caching Demo

Reference workflow for caching demo; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** reference.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/developer-tools-and-infra/stagehand/caching-demo`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/developer-tools-and-infra/stagehand/caching-demo/README.md).
- [Dependency manifest `use-cases/developer-tools-and-infra/stagehand/caching-demo/package.json`](../../use-cases/developer-tools-and-infra/stagehand/caching-demo/package.json).
- [Source `use-cases/developer-tools-and-infra/stagehand/caching-demo/src/act-cache-demo.ts`](../../use-cases/developer-tools-and-infra/stagehand/caching-demo/src/act-cache-demo.ts).
- [Source `use-cases/developer-tools-and-infra/stagehand/caching-demo/src/01-act-cache-with-variables.ts`](../../use-cases/developer-tools-and-infra/stagehand/caching-demo/src/01-act-cache-with-variables.ts).
- [Source `use-cases/developer-tools-and-infra/stagehand/caching-demo/src/02-agent-cache-test.ts`](../../use-cases/developer-tools-and-infra/stagehand/caching-demo/src/02-agent-cache-test.ts).
- Original use-case taxonomy: developer-tools-and-infra.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/developer-tools-and-infra/stagehand/caching-demo
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/developer-tools-and-infra/stagehand/caching-demo/.env.example) lists example configuration. Fill in your own values locally.

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

Declared runtime dependencies from [use-cases/developer-tools-and-infra/stagehand/caching-demo/package.json](../../use-cases/developer-tools-and-infra/stagehand/caching-demo/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@ai-sdk/openai` | `4.0.59` |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `ai` | `7.0.93` |
| `dotenv` | `17.4.2` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Browser configuration](../topics/browser-features.md), [Forms and transactions](../topics/forms-and-transactions.md), [Testing and observability](../topics/testing-and-observability.md).
