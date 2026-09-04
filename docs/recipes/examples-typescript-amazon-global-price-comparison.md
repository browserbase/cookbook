# Amazon global price comparison (TypeScript)

Compare Amazon product prices across multiple countries using geolocation proxies.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/typescript/amazon-global-price-comparison`.
- Languages: typescript.
- Frameworks: Stagehand, Browserbase SDK.
- [Upstream setup and behavior](../../examples/typescript/amazon-global-price-comparison/README.md).
- [Dependency manifest `examples/typescript/amazon-global-price-comparison/package.json`](../../examples/typescript/amazon-global-price-comparison/package.json).
- [Source `examples/typescript/amazon-global-price-comparison/index.ts`](../../examples/typescript/amazon-global-price-comparison/index.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/typescript/amazon-global-price-comparison
corepack enable
pnpm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
pnpm start
```

## Environment

[Environment template](../../examples/typescript/amazon-global-price-comparison/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `MAX_COUNTRIES` | Recipe configuration. Configures max countries behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [examples/typescript/amazon-global-price-comparison/package.json](../../examples/typescript/amazon-global-price-comparison/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/stagehand` | `4.0.2` |
| `dotenv` | `^16.4.7` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/typescript/amazon-global-price-comparison) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Browser configuration](../topics/browser-features.md), [Commerce and travel](../topics/commerce-and-travel.md).
