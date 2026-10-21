# Card entry with Evervault Browser Tokens

Collect an encrypted test card, create Evervault Browser Tokens, run one proxied Browserbase checkout with Stagehand v4, then confirm cleanup and exit.

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
- [Source `examples/typescript/evervault-browser-tokens/index.ts`](../../examples/typescript/evervault-browser-tokens/index.ts).
- Original use-case taxonomy: code-reference, synthetic-card, network-boundary.

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
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Server-only key for one hosted browser and explicit CA setup. Secret. | `<set-locally>` | Must be set locally; placeholders are rejected. No default. |
| `CARD_TARGET_HOST` | Reader infrastructure. Exact public hostname exposing only the synthetic merchant routes. Non-secret. | `cards.example.com` | Must be set locally; placeholders are rejected. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_CA_CERTIFICATE_ID` | [Browserbase](https://docs.browserbase.com/platform/identity/proxies). Trusted Evervault CA ID printed by setup; copy the assignment into your private .env. Non-secret. | `<your-certificate-id>` | See recipe setup and configuration requirements. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `PORT` | Local application. Loopback-only local page/API port; update the merchant proxy upstream if changed. Non-secret. | `4173` | See recipe setup and configuration requirements. Default: `4173`. |
| `DEMO_RECORD_SESSION` | [Local application](https://docs.browserbase.com/platform/browser/observability/session-replay). Explicit opt-in to Browserbase recording for public-fixture debugging; network logs stay disabled. Non-secret. | `false` | Accepts only true or false; never use with real cards or customer data. Default: `false`. |


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
| Clean install verified | 2026-10-21 | `Node.js 24.19.0; npm 12.2.0; macOS arm64; pinned package-lock.json; new disposable package without node_modules` | `npm exec --yes --package=npm@12.2.0 -- npm ci --ignore-scripts --min-release-age=7` | passed. Independent clean installation of the session-link/recording-option update succeeded with 116 packages and zero audit findings. No certificate setup or external browser workflow was run. |
| Offline behavior tested | 2026-10-21 | `Node.js 24.19.0; npm 12.2.0; TypeScript 5.9.2; Stagehand 4.1.0; Browserbase SDK 2.18.0; macOS arm64` | `npm exec --yes --package=npm@12.2.0 -- npm run check` | passed. Typecheck and 44 offline tests passed in the independently installed package. Mocked local browser checks covered hosted collection, dashboard-link handoff before attach, automatic synthetic approval and terminal exit, sanitized pre-launch failure display, and desktop/390px layouts. No fresh live session, recording/replay, proxy swap, CA upload, HTTPS deployment or payment was validated for this update. |

- Use reader-owned sandbox credentials and the public Visa fixture. Run npm run setup explicitly; copy its printed CA assignment into your private .env.
- One invocation accepts one ciphertext handoff, starts at most one billable Browserbase session, submits one synthetic checkout, then confirms cleanup and exits. Ctrl+C/SIGTERM waits for acquired resources; it cannot undo an already-started submission.
- The synthetic merchant receives plaintext public fixture values. This is not a production payment architecture or PCI-compliance claim.
- Collection stays on localhost. Remote Browserbase requires reader-managed HTTPS exposure forwarding only GET /mock-merchant/checkout and POST /mock-merchant/authorize.
- The authenticated Browserbase dashboard link appears on the local page and in the terminal after launch. Recording is off by default; explicit fixture-only opt-in can retain displayed temporary tokens. Keep runtime links and recordings private.
- Current session-link, recording-option and diagnostic changes are offline-tested. Historical live canary and later failed attempt are scoped in the source README; neither validates these changes. New CA upload and Caddy deployment remain unverified.

## Provenance

Cookbook-authored example. Its reviewed source is included at the local paths above.

Related topics: [Forms and transactions](../topics/forms-and-transactions.md), [Browser configuration](../topics/browser-features.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md), [Testing and observability](../topics/testing-and-observability.md).
