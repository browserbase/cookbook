# Demo

Private source-inspected example for demo.

**Status:** current · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/commerce-and-market-intel/sample-05/demo`.
- Languages: typescript.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../use-cases/commerce-and-market-intel/sample-05/demo/README.md).
- [Dependency manifest `use-cases/commerce-and-market-intel/sample-05/demo/package.json`](../../use-cases/commerce-and-market-intel/sample-05/demo/package.json).
- [Source `use-cases/commerce-and-market-intel/sample-05/demo/main.ts`](../../use-cases/commerce-and-market-intel/sample-05/demo/main.ts).
- Original use-case taxonomy: commerce-and-market-intel.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/commerce-and-market-intel/sample-05/demo
npm install
npm run typecheck
cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm start
```

## Environment

[Environment template](../../use-cases/commerce-and-market-intel/sample-05/demo/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `WORKDAY_USERNAME` | Recipe configuration. Provides the workday username credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `WORKDAY_PASSWORD` | Recipe configuration. Provides the workday password credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `WORKDAY_LOGIN_URL` | Recipe configuration. Configures the workday login url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |
| `WORKDAY_PAYMENT_URL` | Recipe configuration. Configures the workday payment url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |
| `PAYMENT_DATA_PATH` | Recipe configuration. Configures payment data path behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/commerce-and-market-intel/sample-05/demo/package.json](../../use-cases/commerce-and-market-intel/sample-05/demo/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.0` |
| `dotenv` | `17.4.2` |
| `playwright-core` | `1.62.1` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.
- The new local package uses the cookbook migration dependency versions. Scripts run live account workflows and still need source-specific configuration; package installation/typechecking alone does not verify those workflows.
- Performs payment submission; no validated confirmation or safe draft handoff is established by the current source.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/commerce-and-market-intel/sample-05/demo) at commit `0000000000000000000000000000000000000000`.

Related topics: [Forms and transactions](../topics/forms-and-transactions.md), [Business operations](../topics/business-operations.md).
