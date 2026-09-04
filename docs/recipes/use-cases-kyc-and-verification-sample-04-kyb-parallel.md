# Kyb Parallel

Private source-inspected example for kyb parallel.

**Status:** current · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/kyc-and-verification/sample-04/kyb-parallel`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/kyc-and-verification/sample-04/kyb-parallel/README.md).
- [Dependency manifest `use-cases/kyc-and-verification/sample-04/kyb-parallel/package.json`](../../use-cases/kyc-and-verification/sample-04/kyb-parallel/package.json).
- [Source `use-cases/kyc-and-verification/sample-04/kyb-parallel/kyb-parallel.ts`](../../use-cases/kyc-and-verification/sample-04/kyb-parallel/kyb-parallel.ts).
- [Source `use-cases/kyc-and-verification/sample-04/kyb-parallel/server.ts`](../../use-cases/kyc-and-verification/sample-04/kyb-parallel/server.ts).
- Original use-case taxonomy: kyc-and-verification.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/kyc-and-verification/sample-04/kyb-parallel
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run dev
npm run start
```

## Environment

[Environment template](../../use-cases/kyc-and-verification/sample-04/kyb-parallel/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `PORT` | Recipe configuration. Configures port behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/kyc-and-verification/sample-04/kyb-parallel/package.json](../../use-cases/kyc-and-verification/sample-04/kyb-parallel/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.0` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `dotenv` | `17.4.2` |
| `zod` | `4.5.4` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/kyc-and-verification/sample-04/kyb-parallel) at commit `0000000000000000000000000000000000000000`.

Related topics: [Business operations](../topics/business-operations.md).
