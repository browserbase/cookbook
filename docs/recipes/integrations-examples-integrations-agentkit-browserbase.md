# AgentKit · Browserbase

Reddit Search Agent with Browserbase and Agent Kit

**Status:** current · public · source inspected.

**Recipe type:** integration package.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `integrations/examples/integrations/agentkit/browserbase`.
- Languages: typescript.
- Frameworks: @inngest/agent-kit.
- [Upstream setup and behavior](../../integrations/examples/integrations/agentkit/browserbase/README.md).
- [Dependency manifest `integrations/examples/integrations/agentkit/browserbase/package.json`](../../integrations/examples/integrations/agentkit/browserbase/package.json).
- [Source `integrations/examples/integrations/agentkit/browserbase/src/index.ts`](../../integrations/examples/integrations/agentkit/browserbase/src/index.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd integrations/examples/integrations/agentkit/browserbase
npm install
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [integrations/examples/integrations/agentkit/browserbase/package.json](../../integrations/examples/integrations/agentkit/browserbase/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@inngest/agent-kit` | `0.13.2` |
| `dotenv` | `16.6.1` |
| `playwright-core` | `1.63.0` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- README npm start command is invalid because package.json has no start script. src/index.ts creates the AgentKit server; add an explicit TypeScript runner.

## Provenance

[Pinned upstream source](https://github.com/browserbase/integrations/tree/b7bc81c6fd4e089ab0c0df2b82529b200739e458/examples/integrations/agentkit/browserbase) at commit `b7bc81c6fd4e089ab0c0df2b82529b200739e458`.

Related topics: [Extraction and research](../topics/extraction-and-research.md), [Agents and human handoff](../topics/agents-and-human-handoff.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md).
