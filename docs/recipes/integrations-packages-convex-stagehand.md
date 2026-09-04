# Convex Stagehand

Convex-stagehand

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `integrations/packages/convex-stagehand`.
- Languages: javascript, typescript.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../integrations/packages/convex-stagehand/README.md).
- [Dependency manifest `integrations/packages/convex-stagehand/package.json`](../../integrations/packages/convex-stagehand/package.json).
- [Source `integrations/packages/convex-stagehand/src/client/index.ts`](../../integrations/packages/convex-stagehand/src/client/index.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd integrations/packages/convex-stagehand
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
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `MODEL_API_KEY` | Recipe configuration. Authenticates requests to Recipe configuration. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [integrations/packages/convex-stagehand/package.json](../../integrations/packages/convex-stagehand/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@ai-sdk/anthropic` | `4.0.49` |
| `@ai-sdk/google` | `4.0.64` |
| `@ai-sdk/openai` | `4.0.59` |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `ai` | `7.0.93` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Example uses convex-stagehand package name while package is @browserbasehq/convex-stagehand; verify local package alias wiring before presenting as standalone.

## Provenance

[Pinned upstream source](https://github.com/browserbase/integrations/tree/b7bc81c6fd4e089ab0c0df2b82529b200739e458/packages/convex-stagehand) at commit `b7bc81c6fd4e089ab0c0df2b82529b200739e458`.

Related topics: [Integrations and orchestration](../topics/integrations-and-orchestration.md).
