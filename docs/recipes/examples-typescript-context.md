# Context (TypeScript)

Demonstrate persistent authentication using Browserbase contexts that survive across sessions.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/typescript/context`.
- Languages: typescript.
- Frameworks: Stagehand, Browserbase SDK.
- [Upstream setup and behavior](../../examples/typescript/context/README.md).
- [Dependency manifest `examples/typescript/context/package.json`](../../examples/typescript/context/package.json).
- [Source `examples/typescript/context/index.ts`](../../examples/typescript/context/index.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/typescript/context
corepack enable
pnpm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
pnpm start
```

## Environment

[Environment template](../../examples/typescript/context/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `SF_REC_PARK_EMAIL` | Recipe configuration. Provides the sf rec park email credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `SF_REC_PARK_PASSWORD` | Recipe configuration. Provides the sf rec park password credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [examples/typescript/context/package.json](../../examples/typescript/context/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `dotenv` | `^16.4.5` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/typescript/context) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Authentication and saved sessions](../topics/authentication.md).
