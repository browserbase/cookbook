# Retail payment research reference

Reference workflow for retail payment research reference; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** reference.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/retail-pricing-intelligence/live-demo`.
- Languages: javascript.
- Frameworks: @browserbasehq/sdk.
- [Upstream setup and behavior](../../use-cases/retail-pricing-intelligence/live-demo/README.md).
- [Dependency manifest `use-cases/retail-pricing-intelligence/live-demo/package.json`](../../use-cases/retail-pricing-intelligence/live-demo/package.json).
- [Dependency manifest `use-cases/retail-pricing-intelligence/demo/package.json`](../../use-cases/retail-pricing-intelligence/demo/package.json).
- [Source `use-cases/retail-pricing-intelligence/live-demo/create-agents.mjs`](../../use-cases/retail-pricing-intelligence/live-demo/create-agents.mjs).
- [Source `use-cases/retail-pricing-intelligence/live-demo/run-all.mjs`](../../use-cases/retail-pricing-intelligence/live-demo/run-all.mjs).
- Original use-case taxonomy: uncategorized.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/retail-pricing-intelligence/live-demo
npm install
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `PORT` | Recipe configuration. Configures port behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/retail-pricing-intelligence/live-demo/package.json](../../use-cases/retail-pricing-intelligence/live-demo/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |

### Additional manifest: `use-cases/retail-pricing-intelligence/demo/package.json`

[Manifest](../../use-cases/retail-pricing-intelligence/demo/package.json). Follow the documented setup path; these declarations are not merged with the primary manifest.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `express` | `5.2.1` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Export BROWSERBASE_API_KEY before launch; these scripts do not load dotenv. npm run sync creates or updates remote agents and writes agents.json; npm run run then launches them and writes results.json. These are live operations, not local checks. sync:dry also reads the remote account.
- The sibling demo directory is a separate application with its own package.json; its dependencies are listed separately below. This setup covers live-demo only. Read the parent README for the other demonstration.
- Each sibling package keeps its own dependency installation. The primary dependency table describes only the working directory above; additional manifests retain their separate declarations.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Forms and transactions](../topics/forms-and-transactions.md), [Testing and observability](../topics/testing-and-observability.md), [Commerce and travel](../topics/commerce-and-travel.md).
