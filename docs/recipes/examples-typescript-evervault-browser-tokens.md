# Card entry with Evervault Browser Tokens

Automatically compare proxied and direct synthetic card checkouts with a minimal hosted-collection page, Evervault Browser Tokens, Stagehand v4, and Browserbase.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · offline behavior tested.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/typescript/evervault-browser-tokens`.
- Languages: typescript.
- Frameworks: Stagehand, Browserbase SDK, Express, Evervault.
- [Upstream setup and behavior](../../examples/typescript/evervault-browser-tokens/README.md).
- [Dependency manifest `examples/typescript/evervault-browser-tokens/package.json`](../../examples/typescript/evervault-browser-tokens/package.json).
- [Dependency manifest `examples/typescript/evervault-browser-tokens/package-lock.json`](../../examples/typescript/evervault-browser-tokens/package-lock.json).
- [Source `examples/typescript/evervault-browser-tokens/src/server.ts`](../../examples/typescript/evervault-browser-tokens/src/server.ts).
- Original use-case taxonomy: reference-app, synthetic-card, network-boundary.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/typescript/evervault-browser-tokens
npm ci --ignore-scripts --min-release-age=7
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm start
```

## Environment

[Environment template](../../examples/typescript/evervault-browser-tokens/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `EVERVAULT_TEAM_ID` | [Evervault](https://docs.evervault.com/cards/card-collection). Public Team ID for hosted card collection. Non-secret. | `<your-team-id>` | Must be set locally; placeholders are rejected. No default. |
| `EVERVAULT_APP_ID` | [Evervault](https://docs.evervault.com/cards/card-collection). Public sandbox App ID for collection and server authentication. Non-secret. | `<your-sandbox-app-id>` | Must be set locally; placeholders are rejected. No default. |
| `EVERVAULT_API_KEY` | [Evervault](https://docs.evervault.com/browser-tokens). Server-only sandbox key for short-lived Browser Tokens. Secret. | `<set-locally>` | Must be set locally; placeholders are rejected. No default. |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Server-only key for matched hosted browsers and CA setup. Secret. | `<set-locally>` | Must be set locally; placeholders are rejected. No default. |
| `CARD_TARGET_HOST` | Reader infrastructure. Exact public hostname exposing only the synthetic merchant routes. Non-secret. | `cards.example.com` | Must be set locally; placeholders are rejected. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_CA_CERTIFICATE_ID` | [Browserbase](https://docs.browserbase.com/platform/identity/proxies). Trusted Evervault CA uploaded by the explicit setup command. Non-secret. | `<your-certificate-id>` | See recipe setup and configuration requirements. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `PORT` | Local application. Loopback-only local page/API port; update the merchant proxy upstream if changed. Non-secret. | `4173` | See recipe setup and configuration requirements. Default: `4173`. |


## Dependencies

Declared runtime dependencies from [examples/typescript/evervault-browser-tokens/package.json](../../examples/typescript/evervault-browser-tokens/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.18.0` |
| `@browserbasehq/stagehand` | `4.1.0` |
| `dotenv` | `16.6.1` |
| `express` | `5.1.0` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

| Check | Date | Runtime | Command | Result and limits |
| --- | --- | --- | --- | --- |
| Clean install verified | 2026-10-21 | `Node.js 24.19.0; npm 12.2.0; macOS arm64; pinned package-lock.json; new disposable package with no node_modules` | `npm exec --yes --package=npm@12.2.0 -- npm ci --ignore-scripts --min-release-age=7` | passed. Independent clean installation of the automatic refactor succeeded with 116 packages and zero audit findings. No certificate setup or external browser workflow was run. |
| Offline behavior tested | 2026-10-21 | `Node.js 24.19.0; npm 12.2.0; TypeScript 5.9.2; Stagehand 4.1.0; Browserbase SDK 2.18.0; macOS arm64` | `npm exec --yes --package=npm@12.2.0 -- npm run check` | passed. Typecheck and 36 offline tests passed in the independently installed automatic refactor. Browserbase/Evervault calls were mocked. Separate localhost fixture UI checks passed collection, visible tokens, automatic outcomes, Cancel, token clearing, and desktop/390px layout. No fresh live session, proxy swap, CA upload, or payment was executed. |

- Fill your private .env and run npm run setup explicitly to provision or verify the Evervault CA. Follow the source README for the route-limited HTTPS merchant setup.
- Sandbox and public fixtures only; the synthetic merchant receives plaintext test data and is not a production PCI architecture.
- Each live comparison automatically creates two billable Browserbase sessions and submits two synthetic checkouts. Explicit setup contacts services and may upload a CA.
- The page and API remain on localhost; Browserbase requires a reader-controlled HTTPS endpoint exposing only the synthetic merchant routes.
- The current automatic implementation is offline-tested only. The earlier manual implementation at c85deef had one live canary; that does not validate this refactor. Fresh live execution and Caddy deployment remain unverified.

## Provenance

Cookbook-authored example. Its reviewed source is included at the local paths above.

Related topics: [Forms and transactions](../topics/forms-and-transactions.md), [Browser configuration](../topics/browser-features.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md), [Testing and observability](../topics/testing-and-observability.md).
