# Browserbase reducto (TypeScript)

Automate downloading financial PDFs from websites and extract structured data using AI-powered document parsing.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/typescript/browserbase-reducto`.
- Languages: typescript.
- Frameworks: Stagehand, Browserbase SDK.
- [Upstream setup and behavior](../../examples/typescript/browserbase-reducto/README.md).
- [Dependency manifest `examples/typescript/browserbase-reducto/package.json`](../../examples/typescript/browserbase-reducto/package.json).
- [Source `examples/typescript/browserbase-reducto/index.ts`](../../examples/typescript/browserbase-reducto/index.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/typescript/browserbase-reducto
corepack enable
pnpm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
pnpm start
```

## Environment

[Environment template](../../examples/typescript/browserbase-reducto/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `REDUCTOAI_API_KEY` | Reducto. Authenticates requests to Reducto. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [examples/typescript/browserbase-reducto/package.json](../../examples/typescript/browserbase-reducto/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `adm-zip` | `latest` |
| `dotenv` | `latest` |
| `reductoai` | `latest` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/typescript/browserbase-reducto) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Files and documents](../topics/downloads-and-documents.md), [Extraction and research](../topics/extraction-and-research.md).
