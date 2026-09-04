# Kyc Aml

Private source-inspected example for kyc aml.

**Status:** legacy · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/kyc-and-verification/sample-01/kyc-aml`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/kyc-and-verification/sample-01/kyc-aml/README.md).
- [Dependency manifest `use-cases/kyc-and-verification/sample-01/kyc-aml/package.json`](../../use-cases/kyc-and-verification/sample-01/kyc-aml/package.json).
- [Source `use-cases/kyc-and-verification/sample-01/kyc-aml/src/index.ts`](../../use-cases/kyc-and-verification/sample-01/kyc-aml/src/index.ts).
- [Source `use-cases/kyc-and-verification/sample-01/kyc-aml/./src/adverse-media-screening.ts`](../../use-cases/kyc-and-verification/sample-01/kyc-aml/src/adverse-media-screening.ts).
- [Source `use-cases/kyc-and-verification/sample-01/kyc-aml/./src/company-registry-research.ts`](../../use-cases/kyc-and-verification/sample-01/kyc-aml/src/company-registry-research.ts).
- [Source `use-cases/kyc-and-verification/sample-01/kyc-aml/./src/pep-sanctions-check.ts`](../../use-cases/kyc-and-verification/sample-01/kyc-aml/src/pep-sanctions-check.ts).
- [Source `use-cases/kyc-and-verification/sample-01/kyc-aml/./src/beneficial-ownership.ts`](../../use-cases/kyc-and-verification/sample-01/kyc-aml/src/beneficial-ownership.ts).
- [Source `use-cases/kyc-and-verification/sample-01/kyc-aml/./src/risk-scoring-engine.ts`](../../use-cases/kyc-and-verification/sample-01/kyc-aml/src/risk-scoring-engine.ts).
- Original use-case taxonomy: kyc-and-verification.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/kyc-and-verification/sample-01/kyc-aml
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run dev
npm run start
```

## Environment

[Environment template](../../use-cases/kyc-and-verification/sample-01/kyc-aml/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `DEMO_COMPANY_NAME` | Recipe configuration. Configures demo company name behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `DEMO_JURISDICTION` | Recipe configuration. Configures demo jurisdiction behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `ENABLE_SESSION_RECORDING` | Recipe configuration. Configures enable session recording behavior for this recipe. Non-secret. | `false` | Use the format described by the recipe. No default. |
| `LOG_LEVEL` | Recipe configuration. Configures log level behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `MAX_CONCURRENT_SEARCHES` | Recipe configuration. Configures max concurrent searches behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/kyc-and-verification/sample-01/kyc-aml/package.json](../../use-cases/kyc-and-verification/sample-01/kyc-aml/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/stagehand` | `4.0.2` |
| `chalk` | `6.0.0` |
| `dotenv` | `17.4.2` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Legacy Stagehand dependency ^1.13.0; migration needed before claiming current SDK compatibility.
- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/kyc-and-verification/sample-01/kyc-aml) at commit `0000000000000000000000000000000000000000`.

Related topics: [Business operations](../topics/business-operations.md).
