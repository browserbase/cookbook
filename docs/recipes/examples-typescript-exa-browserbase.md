# Exa Browserbase (TypeScript)

Discover live jobs and prepare applications for human review without submitting.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/typescript/exa-browserbase`.
- Languages: typescript.
- Frameworks: Stagehand, Browserbase SDK.
- [Upstream setup and behavior](../../examples/typescript/exa-browserbase/README.md).
- [Dependency manifest `examples/typescript/exa-browserbase/package.json`](../../examples/typescript/exa-browserbase/package.json).
- [Source `examples/typescript/exa-browserbase/index.ts`](../../examples/typescript/exa-browserbase/index.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/typescript/exa-browserbase
corepack enable
pnpm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
pnpm start
```

## Environment

[Environment template](../../examples/typescript/exa-browserbase/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `EXA_API_KEY` | [Exa](https://dashboard.exa.ai/api-keys). Authenticates requests to Exa. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `COMPANY_QUERY` | Recipe configuration. Configures company query behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `CONCURRENT` | Recipe configuration. Configures concurrent behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [examples/typescript/exa-browserbase/package.json](../../examples/typescript/exa-browserbase/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/stagehand` | `4.0.2` |
| `dotenv` | `latest` |
| `exa-js` | `latest` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/typescript/exa-browserbase) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Forms and transactions](../topics/forms-and-transactions.md), [Agents and human handoff](../topics/agents-and-human-handoff.md).
