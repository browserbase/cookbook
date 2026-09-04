# Eve Browserbase

Browserbase for Eve

**Status:** current · public · source inspected.

**Recipe type:** integration package.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `integrations/packages/eve-browserbase`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../integrations/packages/eve-browserbase/README.md).
- [Dependency manifest `integrations/packages/eve-browserbase/package.json`](../../integrations/packages/eve-browserbase/package.json).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd integrations/packages/eve-browserbase
corepack enable
pnpm install
```

## Environment

No direct environment variable references were extracted. SDK defaults, external configuration, and deployment settings may still require credentials. Read the source before running.

## Dependencies

Declared runtime dependencies from [integrations/packages/eve-browserbase/package.json](../../integrations/packages/eve-browserbase/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- No standalone launch entrypoint established. Read the upstream guide and package exports before integrating.

## Provenance

[Pinned upstream source](https://github.com/browserbase/integrations/tree/b7bc81c6fd4e089ab0c0df2b82529b200739e458/packages/eve-browserbase) at commit `b7bc81c6fd4e089ab0c0df2b82529b200739e458`.

Related topics: [Browser configuration](../topics/browser-features.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md).
