# Temporal

Temporal + Stagehand Integration

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `integrations/examples/integrations/temporal`.
- Languages: javascript, typescript.
- Frameworks: @browserbasehq/stagehand, @temporalio/activity, @temporalio/client, @temporalio/common, @temporalio/worker, @temporalio/workflow.
- [Upstream setup and behavior](../../integrations/examples/integrations/temporal/README.md).
- [Dependency manifest `integrations/examples/integrations/temporal/package.json`](../../integrations/examples/integrations/temporal/package.json).
- [Source `integrations/examples/integrations/temporal/src/research-worker.ts`](../../integrations/examples/integrations/temporal/src/research-worker.ts).
- [Source `integrations/examples/integrations/temporal/src/demo.ts`](../../integrations/examples/integrations/temporal/src/demo.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd integrations/examples/integrations/temporal
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run demo
npm run worker
```

## Environment

[Environment template](../../integrations/examples/integrations/temporal/.env.example) lists example configuration. Fill in your own values locally.

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

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `RESEARCH_OUTPUT_DIR` | Recipe configuration. Configures research output dir behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TEMPORAL_ADDRESS` | Temporal. Configures temporal address behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TEMPORAL_NAMESPACE` | Temporal. Configures temporal namespace behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [integrations/examples/integrations/temporal/package.json](../../integrations/examples/integrations/temporal/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `@temporalio/activity` | `1.23.0` |
| `@temporalio/client` | `1.23.0` |
| `@temporalio/common` | `1.23.0` |
| `@temporalio/worker` | `1.23.0` |
| `@temporalio/workflow` | `1.23.0` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Browser allocation runs once and reconciles uncertain results by metadata; empty lookups never create replacements. Unobserved sessions expire after 30 minutes. Synthetic tests do not establish Temporal replay or provider visibility guarantees.

## Provenance

[Pinned upstream source](https://github.com/browserbase/integrations/tree/b7bc81c6fd4e089ab0c0df2b82529b200739e458/examples/integrations/temporal) at commit `b7bc81c6fd4e089ab0c0df2b82529b200739e458`.

Related topics: [Integrations and orchestration](../topics/integrations-and-orchestration.md).
