# Order lookup for AI support with Functions and Secrets (TypeScript)

Log into the nopCommerce admin demo, look up an order, and return structured fulfillment data and a session replay.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · live workflow tested.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/typescript/order-lookup-function`.
- Languages: typescript.
- Frameworks: Stagehand, Playwright, Browserbase Functions.
- [Upstream setup and behavior](../../examples/typescript/order-lookup-function/README.md).
- [Dependency manifest `examples/typescript/order-lookup-function/package.json`](../../examples/typescript/order-lookup-function/package.json).
- [Dependency manifest `examples/typescript/order-lookup-function/package-lock.json`](../../examples/typescript/order-lookup-function/package-lock.json).
- [Source `examples/typescript/order-lookup-function/index.ts`](../../examples/typescript/order-lookup-function/index.ts).
- Original use-case taxonomy: functions, secrets, stagehand-v4, order-lookup.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/typescript/order-lookup-function
npm ci --ignore-scripts
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run dev
```

## Environment

[Environment template](../../examples/typescript/order-lookup-function/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Connects to the Function-managed session and the Browserbase Model Gateway. Secret. | `<set-locally>` | Non-empty; attach as a Function Secret for deployed runs or set locally in .env. No default. |
| `NOPCOMMERCE_EMAIL` | [nopCommerce](https://admin-demo.nopcommerce.com/login). Admin demo login email. Secret. | `<set-locally>` | Non-empty; attach as a Function Secret for deployed runs or set locally in .env. No default. |
| `NOPCOMMERCE_PASSWORD` | [nopCommerce](https://admin-demo.nopcommerce.com/login). Admin demo login password. Secret. | `<set-locally>` | Non-empty; attach as a Function Secret for deployed runs or set locally in .env. No default. |


## Dependencies

Declared runtime dependencies from [examples/typescript/order-lookup-function/package.json](../../examples/typescript/order-lookup-function/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk-functions` | `1.0.3` |
| `@browserbasehq/stagehand` | `4.1.0` |
| `dotenv` | `^16.4.5` |
| `playwright-core` | `1.55.0` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. A scoped live workflow check is recorded below; only its stated command, date, result, and limits are verified. Other websites, accounts, permissions, costs, and configurations remain unverified.

| Check | Date | Runtime | Command | Result and limits |
| --- | --- | --- | --- | --- |
| Typechecked | 2026-10-19 | `TypeScript 7.0.2; Stagehand 4.1.0; sdk-functions 1.0.3` | `npm --prefix examples/typescript/order-lookup-function run typecheck` | passed. Static validation only. |
| Live workflow tested | 2026-10-19 | `Browserbase Functions; Node.js 24.x; Stagehand 4.1.0; sdk-functions 1.0.3` | `browse functions invoke <function-id> --params '{"orderId":"1"}'` | passed. Published Function authenticated against the shared nopCommerce demo and returned the matching sample order with replay. Malformed order ID returned invalid_input. Shared data, Cloudflare checks, and future availability can vary. |

- Uses the shared nopCommerce admin demo, which resets hourly; sample orders and availability can change.
- Upload the matching Stagehand extension and attach API key, NOPCOMMERCE_EMAIL, and NOPCOMMERCE_PASSWORD Secrets.
- Recordings and model-visible page content can contain sample customer details; returned fields exclude contact data.
- Only read-only order lookup is supported; production callers must enforce customer/order authorization.
- Missing orders and site failures return unavailable; never infer nonexistence from an unavailable result.

## Provenance

Cookbook-authored example. Its reviewed source is included at the local paths above.

Related topics: [Authentication and saved sessions](../topics/authentication.md), [Business operations](../topics/business-operations.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md).
