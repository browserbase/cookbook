# Caching Demo

Private source-inspected example for caching demo.

**Status:** current · private · source inspected.

**Recipe type:** runnable example.
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

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run demo
```

## Environment

[Environment template](../../use-cases/developer-tools-and-infra/stagehand/caching-demo/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

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

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/developer-tools-and-infra/stagehand/caching-demo) at commit `0000000000000000000000000000000000000000`.

Related topics: [Browser configuration](../topics/browser-features.md), [Forms and transactions](../topics/forms-and-transactions.md), [Testing and observability](../topics/testing-and-observability.md).
