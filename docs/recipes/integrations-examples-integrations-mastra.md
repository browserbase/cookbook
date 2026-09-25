# Mastra

Stagehand & Mastra Integration

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `integrations/examples/integrations/mastra`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand, @mastra/core, @mastra/loggers, @mastra/memory, mastra.
- [Upstream setup and behavior](../../integrations/examples/integrations/mastra/README.md).
- [Dependency manifest `integrations/examples/integrations/mastra/package.json`](../../integrations/examples/integrations/mastra/package.json).
- [Source `integrations/examples/integrations/mastra/src/mastra/index.ts`](../../integrations/examples/integrations/mastra/src/mastra/index.ts).
- [Source `integrations/examples/integrations/mastra/src/mastra/tools/index.ts`](../../integrations/examples/integrations/mastra/src/mastra/tools/index.ts).
- [Source `integrations/examples/integrations/mastra/src/mastra/agents/index.ts`](../../integrations/examples/integrations/mastra/src/mastra/agents/index.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd integrations/examples/integrations/mastra
npm install
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run dev
```

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [integrations/examples/integrations/mastra/package.json](../../integrations/examples/integrations/mastra/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@ai-sdk/openai` | `4.0.59` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `@mastra/core` | `1.64.0` |
| `@mastra/loggers` | `1.3.1` |
| `@mastra/memory` | `1.28.2` |
| `mastra` | `1.27.3` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Local typechecking and lifecycle tests do not execute a live Mastra agent, browser, or model request.

## Provenance

[Pinned upstream source](https://github.com/browserbase/integrations/tree/b7bc81c6fd4e089ab0c0df2b82529b200739e458/examples/integrations/mastra) at commit `b7bc81c6fd4e089ab0c0df2b82529b200739e458`.

Related topics: [Integrations and orchestration](../topics/integrations-and-orchestration.md).
