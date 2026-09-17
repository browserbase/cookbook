# V4 Demo Kit

Reference workflow for v4 demo kit; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** reference.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/developer-tools-and-infra/stagehand/v4-demo-kit`.
- Languages: javascript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/developer-tools-and-infra/stagehand/v4-demo-kit/README.md).
- [Dependency manifest `use-cases/developer-tools-and-infra/stagehand/v4-demo-kit/package.json`](../../use-cases/developer-tools-and-infra/stagehand/v4-demo-kit/package.json).
- [Source `use-cases/developer-tools-and-infra/stagehand/v4-demo-kit/src/cli.mjs`](../../use-cases/developer-tools-and-infra/stagehand/v4-demo-kit/src/cli.mjs).
- [Source `use-cases/developer-tools-and-infra/stagehand/v4-demo-kit/src/agent-harness.mjs`](../../use-cases/developer-tools-and-infra/stagehand/v4-demo-kit/src/agent-harness.mjs).
- [Source `use-cases/developer-tools-and-infra/stagehand/v4-demo-kit/scripts/research-hacker-news.mjs`](../../use-cases/developer-tools-and-infra/stagehand/v4-demo-kit/scripts/research-hacker-news.mjs).
- [Source `use-cases/developer-tools-and-infra/stagehand/v4-demo-kit/src/http-server.mjs`](../../use-cases/developer-tools-and-infra/stagehand/v4-demo-kit/src/http-server.mjs).
- [Source `use-cases/developer-tools-and-infra/stagehand/v4-demo-kit/src/session.mjs`](../../use-cases/developer-tools-and-infra/stagehand/v4-demo-kit/src/session.mjs).
- [Source `use-cases/developer-tools-and-infra/stagehand/v4-demo-kit/src/tools.mjs`](../../use-cases/developer-tools-and-infra/stagehand/v4-demo-kit/src/tools.mjs).
- Original use-case taxonomy: developer-tools-and-infra.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/developer-tools-and-infra/stagehand/v4-demo-kit
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/developer-tools-and-infra/stagehand/v4-demo-kit/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `DEMO_BEARER_TOKEN` | Recipe configuration. Provides the demo bearer token credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `STAGEHAND_MODEL_API_KEY` | Stagehand. Authenticates requests to Stagehand. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `AGENT_MODEL` | Recipe configuration. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `PORT` | Recipe configuration. Configures port behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `STAGEHAND_MODEL_NAME` | Stagehand. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/developer-tools-and-infra/stagehand/v4-demo-kit/package.json](../../use-cases/developer-tools-and-infra/stagehand/v4-demo-kit/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@ai-sdk/openai` | `4.0.59` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `ai` | `7.0.93` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Agents and human handoff](../topics/agents-and-human-handoff.md).
