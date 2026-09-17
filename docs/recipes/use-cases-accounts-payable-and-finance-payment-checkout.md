# Payment checkout reference

Reference workflow for payment checkout reference; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** legacy · source inspected.

**Recipe type:** reference.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/accounts-payable-and-finance/payment-checkout`.
- Languages: python, typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/accounts-payable-and-finance/payment-checkout/README.md).
- [Dependency manifest `use-cases/accounts-payable-and-finance/payment-checkout/package.json`](../../use-cases/accounts-payable-and-finance/payment-checkout/package.json).
- [Dependency manifest `use-cases/accounts-payable-and-finance/payment-checkout/requirements.txt`](../../use-cases/accounts-payable-and-finance/payment-checkout/requirements.txt).
- [Source `use-cases/accounts-payable-and-finance/payment-checkout/payment_flow.ts`](../../use-cases/accounts-payable-and-finance/payment-checkout/payment_flow.ts).
- Original use-case taxonomy: accounts-payable-and-finance.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/accounts-payable-and-finance/payment-checkout
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/accounts-payable-and-finance/payment-checkout/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `MODEL_API_KEY` | Recipe configuration. Authenticates requests to Recipe configuration. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/accounts-payable-and-finance/payment-checkout/package.json](../../use-cases/accounts-payable-and-finance/payment-checkout/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `dotenv` | `17.4.2` |
| `zod` | `4.4.3` |

### Additional manifest: `use-cases/accounts-payable-and-finance/payment-checkout/requirements.txt`

[Manifest](../../use-cases/accounts-payable-and-finance/payment-checkout/requirements.txt). Follow the documented setup path; these declarations are not merged with the primary manifest.

- `browserbase==1.18.1`
- `playwright==1.62.0`
- `python-dotenv`
- `stagehand==4.0.2`

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Legacy Stagehand dependency ^3.0.5; migration needed before claiming current SDK compatibility.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Forms and transactions](../topics/forms-and-transactions.md), [Agents and human handoff](../topics/agents-and-human-handoff.md), [Business operations](../topics/business-operations.md).
