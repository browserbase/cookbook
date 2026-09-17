# KYC AML screening

Reference workflow for kyc aml screening; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** legacy · source inspected.

**Recipe type:** reference.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/kyc-and-verification/kyc-aml-screening`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/kyc-and-verification/kyc-aml-screening/README.md).
- [Dependency manifest `use-cases/kyc-and-verification/kyc-aml-screening/package.json`](../../use-cases/kyc-and-verification/kyc-aml-screening/package.json).
- [Source `use-cases/kyc-and-verification/kyc-aml-screening/src/index.ts`](../../use-cases/kyc-and-verification/kyc-aml-screening/src/index.ts).
- [Source `use-cases/kyc-and-verification/kyc-aml-screening/./src/adverse-media-screening.ts`](../../use-cases/kyc-and-verification/kyc-aml-screening/src/adverse-media-screening.ts).
- [Source `use-cases/kyc-and-verification/kyc-aml-screening/./src/company-registry-research.ts`](../../use-cases/kyc-and-verification/kyc-aml-screening/src/company-registry-research.ts).
- [Source `use-cases/kyc-and-verification/kyc-aml-screening/./src/pep-sanctions-check.ts`](../../use-cases/kyc-and-verification/kyc-aml-screening/src/pep-sanctions-check.ts).
- [Source `use-cases/kyc-and-verification/kyc-aml-screening/./src/beneficial-ownership.ts`](../../use-cases/kyc-and-verification/kyc-aml-screening/src/beneficial-ownership.ts).
- [Source `use-cases/kyc-and-verification/kyc-aml-screening/./src/risk-scoring-engine.ts`](../../use-cases/kyc-and-verification/kyc-aml-screening/src/risk-scoring-engine.ts).
- Original use-case taxonomy: kyc-and-verification.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/kyc-and-verification/kyc-aml-screening
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/kyc-and-verification/kyc-aml-screening/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

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

Declared runtime dependencies from [use-cases/kyc-and-verification/kyc-aml-screening/package.json](../../use-cases/kyc-and-verification/kyc-aml-screening/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/stagehand` | `4.0.2` |
| `chalk` | `6.0.0` |
| `dotenv` | `17.4.2` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Legacy Stagehand dependency ^1.13.0; migration needed before claiming current SDK compatibility.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Business operations](../topics/business-operations.md).
