# News intelligence workflow

Reference workflow for news intelligence workflow; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** legacy · source inspected.

**Recipe type:** reference.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/content-and-research/news-intelligence`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/content-and-research/news-intelligence/README.md).
- [Dependency manifest `use-cases/content-and-research/news-intelligence/package.json`](../../use-cases/content-and-research/news-intelligence/package.json).
- [Source `use-cases/content-and-research/news-intelligence/src/main.ts`](../../use-cases/content-and-research/news-intelligence/src/main.ts).
- [Source `use-cases/content-and-research/news-intelligence/src/test.ts`](../../use-cases/content-and-research/news-intelligence/src/test.ts).
- Original use-case taxonomy: content-and-research.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/content-and-research/news-intelligence
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/content-and-research/news-intelligence/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ENABLE_CONTENT_EXTRACTION` | Recipe configuration. Configures enable content extraction behavior for this recipe. Non-secret. | `false` | Use the format described by the recipe. No default. |
| `LOG_LEVEL` | Recipe configuration. Configures log level behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `MAX_POSTS` | Recipe configuration. Configures max posts behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `NODE_ENV` | Recipe configuration. Configures node env behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TIMEOUT_MS` | Recipe configuration. Configures timeout ms behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/content-and-research/news-intelligence/package.json](../../use-cases/content-and-research/news-intelligence/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/stagehand` | `4.0.2` |
| `chalk` | `6.0.0` |
| `dotenv` | `17.4.2` |
| `ora` | `9.4.1` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Legacy Stagehand dependency ^1.5.0; migration needed before claiming current SDK compatibility.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Extraction and research](../topics/extraction-and-research.md).
