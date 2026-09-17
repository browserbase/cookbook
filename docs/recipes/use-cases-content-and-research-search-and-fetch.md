# Search and fetch

Reference workflow for search and fetch; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** reference.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/content-and-research/search-and-fetch`.
- Languages: javascript.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../use-cases/content-and-research/search-and-fetch/README.md).
- [Dependency manifest `use-cases/content-and-research/search-and-fetch/package.json`](../../use-cases/content-and-research/search-and-fetch/package.json).
- [Source `use-cases/content-and-research/search-and-fetch/01-search.js`](../../use-cases/content-and-research/search-and-fetch/01-search.js).
- [Source `use-cases/content-and-research/search-and-fetch/02-fetch.js`](../../use-cases/content-and-research/search-and-fetch/02-fetch.js).
- [Source `use-cases/content-and-research/search-and-fetch/03-extract-signal.js`](../../use-cases/content-and-research/search-and-fetch/03-extract-signal.js).
- [Source `use-cases/content-and-research/search-and-fetch/04-search-to-signal.js`](../../use-cases/content-and-research/search-and-fetch/04-search-to-signal.js).
- [Source `use-cases/content-and-research/search-and-fetch/05-browser-when-needed.js`](../../use-cases/content-and-research/search-and-fetch/05-browser-when-needed.js).
- Original use-case taxonomy: content-and-research.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/content-and-research/search-and-fetch
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/content-and-research/search-and-fetch/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/content-and-research/search-and-fetch/package.json](../../use-cases/content-and-research/search-and-fetch/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.0` |
| `playwright-core` | `1.62.1` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Extraction and research](../topics/extraction-and-research.md).
