# AgentKit · Stagehand

Simple Search Agent with AgentKit and Stagehand

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `integrations/examples/integrations/agentkit/stagehand`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand, @inngest/agent-kit, inngest.
- [Upstream setup and behavior](../../integrations/examples/integrations/agentkit/stagehand/README.md).
- [Dependency manifest `integrations/examples/integrations/agentkit/stagehand/package.json`](../../integrations/examples/integrations/agentkit/stagehand/package.json).
- [Source `integrations/examples/integrations/agentkit/stagehand/src/index.ts`](../../integrations/examples/integrations/agentkit/stagehand/src/index.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd integrations/examples/integrations/agentkit/stagehand
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run start
```

## Environment

[Environment template](../../integrations/examples/integrations/agentkit/stagehand/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [integrations/examples/integrations/agentkit/stagehand/package.json](../../integrations/examples/integrations/agentkit/stagehand/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `@inngest/agent-kit` | `0.13.2` |
| `dotenv` | `16.6.1` |
| `inngest` | `4.20.0` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/integrations/tree/b7bc81c6fd4e089ab0c0df2b82529b200739e458/examples/integrations/agentkit/stagehand) at commit `b7bc81c6fd4e089ab0c0df2b82529b200739e458`.

Related topics: [Extraction and research](../topics/extraction-and-research.md), [Agents and human handoff](../topics/agents-and-human-handoff.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md).
