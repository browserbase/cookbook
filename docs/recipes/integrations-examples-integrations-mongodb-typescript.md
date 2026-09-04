# MongoDB · TypeScript

Stagehand MongoDB Scraper

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `integrations/examples/integrations/mongodb/typescript`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand, mongodb.
- [Upstream setup and behavior](../../integrations/examples/integrations/mongodb/typescript/README.md).
- [Dependency manifest `integrations/examples/integrations/mongodb/typescript/package.json`](../../integrations/examples/integrations/mongodb/typescript/package.json).
- [Source `integrations/examples/integrations/mongodb/typescript/index.ts`](../../integrations/examples/integrations/mongodb/typescript/index.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd integrations/examples/integrations/mongodb/typescript
corepack enable
pnpm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
pnpm run start
```

## Environment

[Environment template](../../integrations/examples/integrations/mongodb/typescript/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `DB_NAME` | Recipe configuration. Configures db name behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `MONGO_URI` | Recipe configuration. Configures the mongo uri endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [integrations/examples/integrations/mongodb/typescript/package.json](../../integrations/examples/integrations/mongodb/typescript/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `@playwright/test` | `1.63.0` |
| `boxen` | `8.0.1` |
| `chalk` | `6.0.0` |
| `dotenv` | `16.6.1` |
| `mongodb` | `7.6.0` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/integrations/tree/b7bc81c6fd4e089ab0c0df2b82529b200739e458/examples/integrations/mongodb/typescript) at commit `b7bc81c6fd4e089ab0c0df2b82529b200739e458`.

Related topics: [Integrations and orchestration](../topics/integrations-and-orchestration.md).
