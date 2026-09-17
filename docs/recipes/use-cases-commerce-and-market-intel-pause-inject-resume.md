# Pause inject resume

Reference workflow for pause inject resume; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** reference.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/commerce-and-market-intel/pause-inject-resume`.
- Languages: python.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../use-cases/commerce-and-market-intel/pause-inject-resume/README.md).
- [Dependency manifest `use-cases/commerce-and-market-intel/pause-inject-resume/pyproject.toml`](../../use-cases/commerce-and-market-intel/pause-inject-resume/pyproject.toml).
- Original use-case taxonomy: commerce-and-market-intel.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

This source has no established standalone launch command. Read its upstream guide and integrate its exports or configure its application first.

## Environment

[Environment template](../../use-cases/commerce-and-market-intel/pause-inject-resume/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `CI` | Recipe configuration. Configures ci behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `STAGEHAND_HEADLESS` | Stagehand. Configures stagehand headless behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `RETAIL_DEMO_BROWSER` | Recipe configuration. Configures target service demo browser behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `RETAIL_DEMO_CLAUDE_MODEL` | Recipe configuration. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `RETAIL_DEMO_MODE` | Recipe configuration. Configures target service demo mode behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `RETAIL_DEMO_MODEL_NAME` | Recipe configuration. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `RETAIL_DEMO_URL` | Recipe configuration. Configures the target service demo url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/commerce-and-market-intel/pause-inject-resume/pyproject.toml](../../use-cases/commerce-and-market-intel/pause-inject-resume/pyproject.toml). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `claude-agent-sdk>=0.2.136`
- `stagehand==4.0.2`

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- No standalone launch entrypoint established. Read the upstream guide and package exports before integrating.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Agents and human handoff](../topics/agents-and-human-handoff.md), [Commerce and travel](../topics/commerce-and-travel.md).
