# Synthetic payment verification handoff

Reference workflow for synthetic payment verification handoff; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** legacy · source inspected.

**Recipe type:** reference.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/accounts-payable-and-finance/payment-verification-handoff`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/accounts-payable-and-finance/payment-verification-handoff/README.md).
- [Dependency manifest `use-cases/accounts-payable-and-finance/payment-verification-handoff/package.json`](../../use-cases/accounts-payable-and-finance/payment-verification-handoff/package.json).
- [Source `use-cases/accounts-payable-and-finance/payment-verification-handoff/agent.ts`](../../use-cases/accounts-payable-and-finance/payment-verification-handoff/agent.ts).
- [Source `use-cases/accounts-payable-and-finance/payment-verification-handoff/serve.ts`](../../use-cases/accounts-payable-and-finance/payment-verification-handoff/serve.ts).
- Original use-case taxonomy: accounts-payable-and-finance.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/accounts-payable-and-finance/payment-verification-handoff
npm install
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `MODEL_NAME` | Recipe configuration. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `PORTAL_URL` | Recipe configuration. Configures the portal url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |
| `SIMULATE_HUMAN` | Recipe configuration. Configures simulate human behavior for this recipe. Non-secret. | `false` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/accounts-payable-and-finance/payment-verification-handoff/package.json](../../use-cases/accounts-payable-and-finance/payment-verification-handoff/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/stagehand` | `4.0.2` |
| `zod` | `4.5.4` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Legacy Stagehand dependency ^2.3.0; migration needed before claiming current SDK compatibility.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Browser configuration](../topics/browser-features.md), [Agents and human handoff](../topics/agents-and-human-handoff.md), [Business operations](../topics/business-operations.md).
