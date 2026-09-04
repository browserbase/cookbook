# Bill Hitl

Private source-inspected example for bill hitl.

**Status:** legacy · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/accounts-payable-and-finance/browserbase/bill-hitl`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/accounts-payable-and-finance/browserbase/bill-hitl/README.md).
- [Dependency manifest `use-cases/accounts-payable-and-finance/browserbase/bill-hitl/package.json`](../../use-cases/accounts-payable-and-finance/browserbase/bill-hitl/package.json).
- [Source `use-cases/accounts-payable-and-finance/browserbase/bill-hitl/agent.ts`](../../use-cases/accounts-payable-and-finance/browserbase/bill-hitl/agent.ts).
- [Source `use-cases/accounts-payable-and-finance/browserbase/bill-hitl/serve.ts`](../../use-cases/accounts-payable-and-finance/browserbase/bill-hitl/serve.ts).
- Original use-case taxonomy: accounts-payable-and-finance.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/accounts-payable-and-finance/browserbase/bill-hitl
npm install
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run agent
```

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

Declared runtime dependencies from [use-cases/accounts-payable-and-finance/browserbase/bill-hitl/package.json](../../use-cases/accounts-payable-and-finance/browserbase/bill-hitl/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/stagehand` | `4.0.2` |
| `zod` | `4.5.4` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Legacy Stagehand dependency ^2.3.0; migration needed before claiming current SDK compatibility.
- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/accounts-payable-and-finance/browserbase/bill-hitl) at commit `0000000000000000000000000000000000000000`.

Related topics: [Browser configuration](../topics/browser-features.md), [Agents and human handoff](../topics/agents-and-human-handoff.md), [Business operations](../topics/business-operations.md).
