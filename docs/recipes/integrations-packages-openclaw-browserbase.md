# OpenClaw Browserbase

@browserbasehq/openclaw-browserbase

**Status:** current · public · source inspected.

**Recipe type:** integration package.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `integrations/packages/openclaw-browserbase`.
- Languages: typescript.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../integrations/packages/openclaw-browserbase/README.md).
- [Dependency manifest `integrations/packages/openclaw-browserbase/package.json`](../../integrations/packages/openclaw-browserbase/package.json).
- [Source `integrations/packages/openclaw-browserbase/src/index.ts`](../../integrations/packages/openclaw-browserbase/src/index.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd integrations/packages/openclaw-browserbase
corepack enable
pnpm install
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [integrations/packages/openclaw-browserbase/package.json](../../integrations/packages/openclaw-browserbase/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `json5` | `2.2.3` |
| `tar` | `^7.5.9` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Skill sync preserves unrelated content and rejects local edits or unowned collisions. A versioned manifest verifies installed files; interrupted rollback requires manual recovery. Local fixture tests do not verify live OpenClaw startup.

## Provenance

[Pinned upstream source](https://github.com/browserbase/integrations/tree/b7bc81c6fd4e089ab0c0df2b82529b200739e458/packages/openclaw-browserbase) at commit `b7bc81c6fd4e089ab0c0df2b82529b200739e458`.

Related topics: [Browser configuration](../topics/browser-features.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md).
