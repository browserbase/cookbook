# Treasury Demo

Private source-inspected example for treasury demo.

**Status:** legacy · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/accounts-payable-and-finance/sample-01/treasury-demo`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/accounts-payable-and-finance/sample-01/treasury-demo/README.md).
- [Dependency manifest `use-cases/accounts-payable-and-finance/sample-01/treasury-demo/package.json`](../../use-cases/accounts-payable-and-finance/sample-01/treasury-demo/package.json).
- [Source `use-cases/accounts-payable-and-finance/sample-01/treasury-demo/index.ts`](../../use-cases/accounts-payable-and-finance/sample-01/treasury-demo/index.ts).
- [Source `use-cases/accounts-payable-and-finance/sample-01/treasury-demo/serve.ts`](../../use-cases/accounts-payable-and-finance/sample-01/treasury-demo/serve.ts).
- Original use-case taxonomy: accounts-payable-and-finance.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/accounts-payable-and-finance/sample-01/treasury-demo
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run dev
npm run demo
```

## Environment

[Environment template](../../use-cases/accounts-payable-and-finance/sample-01/treasury-demo/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BANK_PASSWORD` | Recipe configuration. Provides the bank password credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BANK_USERNAME` | Recipe configuration. Provides the bank username credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `GOOGLE_API_KEY` | [Google AI](https://aistudio.google.com/apikey). Authenticates requests to Google AI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `MODEL_API_KEY` | Recipe configuration. Authenticates requests to Recipe configuration. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BANK_PORTAL_URL` | Recipe configuration. Configures the bank portal url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |
| `MODEL_NAME` | Recipe configuration. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TREASURY_PORTAL_URL` | Recipe configuration. Configures the treasury portal url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/accounts-payable-and-finance/sample-01/treasury-demo/package.json](../../use-cases/accounts-payable-and-finance/sample-01/treasury-demo/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `dotenv` | `17.4.2` |
| `playwright-core` | `1.63.0` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Legacy Stagehand dependency ^2.1.0; migration needed before claiming current SDK compatibility.
- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/accounts-payable-and-finance/sample-01/treasury-demo) at commit `0000000000000000000000000000000000000000`.

Related topics: [Files and documents](../topics/downloads-and-documents.md), [Business operations](../topics/business-operations.md).
