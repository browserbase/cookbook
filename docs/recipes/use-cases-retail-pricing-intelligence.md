# Retail Pricing Intelligence

Private source-inspected example for retail pricing intelligence.

**Status:** current · private · source inspected.

**Recipe type:** runnable example.
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

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run sync
npm run run
```

## Environment

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

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.
- Export BROWSERBASE_API_KEY before launch; these scripts do not load dotenv. npm run sync creates or updates remote agents and writes agents.json; npm run run then launches them and writes results.json. These are live operations, not local checks. sync:dry also reads the remote account.
- The sibling demo directory is a separate application with its own package.json; its dependencies are listed separately below. This setup covers live-demo only. Read the parent README for the other demonstration.
- Each sibling package keeps its own dependency installation. The primary dependency table describes only the working directory above; additional manifests retain their separate declarations.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/retail-pricing-intelligence) at commit `0000000000000000000000000000000000000000`.

Related topics: [Forms and transactions](../topics/forms-and-transactions.md), [Testing and observability](../topics/testing-and-observability.md), [Commerce and travel](../topics/commerce-and-travel.md).
