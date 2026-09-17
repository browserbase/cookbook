# Vercel · Eve example

Example Eve browser agent

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `integrations/packages/eve-browserbase`.
- Languages: typescript.
- Frameworks: @browserbasehq/eve, @browserbasehq/stagehand, eve.
- [Upstream setup and behavior](../../integrations/examples/integrations/vercel/eve-example/README.md).
- [Dependency manifest `integrations/examples/integrations/vercel/eve-example/package.json`](../../integrations/examples/integrations/vercel/eve-example/package.json).
- [Dependency manifest `integrations/packages/eve-browserbase/package.json`](../../integrations/packages/eve-browserbase/package.json).
- [Source `integrations/examples/integrations/vercel/eve-example/agent/agent.ts`](../../integrations/examples/integrations/vercel/eve-example/agent/agent.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd integrations/packages/eve-browserbase
nvm use
corepack enable
pnpm install
pnpm build
test -f ../../examples/integrations/vercel/eve-example/.env || cp ../../examples/integrations/vercel/eve-example/.env.example ../../examples/integrations/vercel/eve-example/.env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
pnpm --filter browserbase-eve-example dev
```

## Environment

[Environment template](../../integrations/examples/integrations/vercel/eve-example/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `AI_GATEWAY_API_KEY` | Recipe configuration. Authenticates requests to Recipe configuration. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [integrations/examples/integrations/vercel/eve-example/package.json](../../integrations/examples/integrations/vercel/eve-example/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/eve` | `workspace:*` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `ai` | `7.0.93` |
| `eve` | `0.52.1` |
| `zod` | `4.4.3` |

### Additional manifest: `integrations/packages/eve-browserbase/package.json`

[Manifest](../../integrations/packages/eve-browserbase/package.json). Follow the documented setup path; these declarations are not merged with the primary manifest.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Uses workspace:* dependency on @browserbasehq/eve. Preserve monorepo root and packages/eve-browserbase together.
- Requires Node.js 24 or newer. Run installation and build from the Eve package workspace; fill the example environment file before starting the TUI.

## Provenance

[Pinned upstream source](https://github.com/browserbase/integrations/tree/b7bc81c6fd4e089ab0c0df2b82529b200739e458/examples/integrations/vercel/eve-example) at commit `b7bc81c6fd4e089ab0c0df2b82529b200739e458`.

Related topics: [Agents and human handoff](../topics/agents-and-human-handoff.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md).
