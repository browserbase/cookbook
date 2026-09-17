# Smart fetch scraper (TypeScript)

Try raw Fetch HTML first, inspect its text with an HTML parser, and use a browser when structural heuristics request fallback.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/typescript/smart-fetch-scraper`.
- Languages: typescript.
- Frameworks: Stagehand, Browserbase SDK.
- [Upstream setup and behavior](../../examples/typescript/smart-fetch-scraper/README.md).
- [Dependency manifest `examples/typescript/smart-fetch-scraper/package.json`](../../examples/typescript/smart-fetch-scraper/package.json).
- [Source `examples/typescript/smart-fetch-scraper/index.ts`](../../examples/typescript/smart-fetch-scraper/index.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/typescript/smart-fetch-scraper
corepack enable
pnpm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
pnpm start https://news.ycombinator.com
```

## Environment

[Environment template](../../examples/typescript/smart-fetch-scraper/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [examples/typescript/smart-fetch-scraper/package.json](../../examples/typescript/smart-fetch-scraper/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `cheerio` | `1.2.0` |
| `dotenv` | `^16.4.5` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/typescript/smart-fetch-scraper) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Testing and observability](../topics/testing-and-observability.md).
