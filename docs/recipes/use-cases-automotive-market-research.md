# Automotive Market Research

Reference workflow for automotive market research; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** reference.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/automotive-market-research`.
- Languages: javascript.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../use-cases/automotive-market-research/README.md).
- [Dependency manifest `use-cases/automotive-market-research/package.json`](../../use-cases/automotive-market-research/package.json).
- [Source `use-cases/automotive-market-research/server.js`](../../use-cases/automotive-market-research/server.js).
- [Source `use-cases/automotive-market-research/scripts/setup-agent.js`](../../use-cases/automotive-market-research/scripts/setup-agent.js).
- Original use-case taxonomy: uncategorized.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/automotive-market-research
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
| `BROWSERBASE_AGENT_ID` | [Browserbase](https://www.browserbase.com/settings). Configures browserbase agent id behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `PORT` | Recipe configuration. Configures port behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/automotive-market-research/package.json](../../use-cases/automotive-market-research/package.json). Alternate manifests may differ; use the documented setup path.

Consult the linked manifest or upstream instructions. This catalog does not invent missing dependency versions.

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Browser configuration](../topics/browser-features.md).
