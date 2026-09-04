# LangChain · Stagehand

Langchain JS

**Status:** current · public · source inspected.

**Recipe type:** integration package.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `integrations/examples/integrations/langchain/stagehand`.
- Languages: javascript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../integrations/examples/integrations/langchain/stagehand/README.md).
- [Dependency manifest `integrations/examples/integrations/langchain/stagehand/package.json`](../../integrations/examples/integrations/langchain/stagehand/package.json).
- [Source `integrations/examples/integrations/langchain/stagehand/src/index.js`](../../integrations/examples/integrations/langchain/stagehand/src/index.js).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd integrations/examples/integrations/langchain/stagehand
npm install
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

No direct environment variable references were extracted. SDK defaults, external configuration, and deployment settings may still require credentials. Read the source before running.

## Dependencies

Declared runtime dependencies from [integrations/examples/integrations/langchain/stagehand/package.json](../../integrations/examples/integrations/langchain/stagehand/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/stagehand` | `4.0.2` |
| `@langchain/core` | `1.2.9` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Local contract tests do not execute a live browser or model request.

## Provenance

[Pinned upstream source](https://github.com/browserbase/integrations/tree/b7bc81c6fd4e089ab0c0df2b82529b200739e458/examples/integrations/langchain/stagehand) at commit `b7bc81c6fd4e089ab0c0df2b82529b200739e458`.

Related topics: [Integrations and orchestration](../topics/integrations-and-orchestration.md).
