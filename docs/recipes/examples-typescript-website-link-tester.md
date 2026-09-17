# Website link tester (TypeScript)

Crawl a website’s homepage, collect all links, and verify that each link loads successfully and matches its link text.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/typescript/website-link-tester`.
- Languages: typescript.
- Frameworks: Stagehand, Browserbase SDK.
- [Upstream setup and behavior](../../examples/typescript/website-link-tester/README.md).
- [Dependency manifest `examples/typescript/website-link-tester/package.json`](../../examples/typescript/website-link-tester/package.json).
- [Source `examples/typescript/website-link-tester/index.ts`](../../examples/typescript/website-link-tester/index.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/typescript/website-link-tester
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm start
```

## Environment

[Environment template](../../examples/typescript/website-link-tester/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `MAX_CONCURRENT_LINKS` | Recipe configuration. Configures max concurrent links behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `MAX_LINKS` | Recipe configuration. Configures max links behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [examples/typescript/website-link-tester/package.json](../../examples/typescript/website-link-tester/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/stagehand` | `4.0.2` |
| `dotenv` | `^17.4.2` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/typescript/website-link-tester) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Testing and observability](../topics/testing-and-observability.md).
