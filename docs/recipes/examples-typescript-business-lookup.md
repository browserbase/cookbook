# Business lookup (TypeScript)

Give an external agent a Browserbase browser and have it research one SF business record.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/typescript/business-lookup`.
- Languages: typescript.
- Frameworks: Stagehand, Vercel AI SDK, Browserbase SDK.
- [Upstream setup and behavior](../../examples/typescript/business-lookup/README.md).
- [Dependency manifest `examples/typescript/business-lookup/package.json`](../../examples/typescript/business-lookup/package.json).
- [Source `examples/typescript/business-lookup/index.ts`](../../examples/typescript/business-lookup/index.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/typescript/business-lookup
corepack enable
pnpm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
pnpm start
```

## Environment

[Environment template](../../examples/typescript/business-lookup/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `AI_GATEWAY_API_KEY` | Recipe configuration. Authenticates requests to Recipe configuration. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `AGENT_MODEL` | Recipe configuration. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [examples/typescript/business-lookup/package.json](../../examples/typescript/business-lookup/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@ai-sdk/mcp` | `^2.0.29` |
| `@browserbasehq/stagehand-codemode` | `github:browserbase/stagehand#54302fc5f13be5ad8e717d8e1388502de22be2ed&path:packages/integrations` |
| `ai` | `^7.0.58` |
| `dotenv` | `^17.4.2` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Code-mode integration is pinned to a Git commit. Use the declared pnpm version and overrides when present.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/typescript/business-lookup) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Extraction and research](../topics/extraction-and-research.md), [Agents and human handoff](../topics/agents-and-human-handoff.md), [Business operations](../topics/business-operations.md).
