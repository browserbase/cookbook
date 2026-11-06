# Wait for CAPTCHA solving and verify access

Pause Playwright or Stagehand v4 while solving, verify application readiness, and revisit the original URL at most once within a shared deadline

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · offline behavior tested.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/typescript/captcha-solving-wait-and-verify`.
- Languages: typescript.
- Frameworks: Playwright, Stagehand, Browserbase SDK.
- [Upstream setup and behavior](../../examples/typescript/captcha-solving-wait-and-verify/README.md).
- [Dependency manifest `examples/typescript/captcha-solving-wait-and-verify/package.json`](../../examples/typescript/captcha-solving-wait-and-verify/package.json).
- [Dependency manifest `examples/typescript/captcha-solving-wait-and-verify/package-lock.json`](../../examples/typescript/captcha-solving-wait-and-verify/package-lock.json).
- [Source `examples/typescript/captcha-solving-wait-and-verify/playwright.ts`](../../examples/typescript/captcha-solving-wait-and-verify/playwright.ts).
- [Source `examples/typescript/captcha-solving-wait-and-verify/stagehand.ts`](../../examples/typescript/captcha-solving-wait-and-verify/stagehand.ts).
- Original use-case taxonomy: stagehand-v4, captcha, readiness.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/typescript/captcha-solving-wait-and-verify
npm ci
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run playwright
npm run stagehand
```

## Environment

[Environment template](../../examples/typescript/captcha-solving-wait-and-verify/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticate Browserbase sessions Secret. | `<set-locally>` | Nonempty value. No default. |
| `TARGET_URL` | Application. Authorized page to navigate to and revisit once Non-secret. | `<set-locally>` | Nonempty value. No default. |
| `EXPECTED_SELECTOR` | Application. Unique CSS selector for post-challenge content Non-secret. | `<set-locally>` | Nonempty value. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `CAPTCHA_TIMEOUT_MS` | Application. Overall navigation and readiness deadline in milliseconds Non-secret. | `90000` | See source README for allowed values. Default: `90000`. |
| `USE_PROXIES` | Application. Enable Browserbase proxies Non-secret. | `false` | See source README for allowed values. Default: `false`. |
| `USE_VERIFIED` | Application. Request Verified on an eligible account Non-secret. | `false` | See source README for allowed values. Default: `false`. |


## Dependencies

Declared runtime dependencies from [examples/typescript/captcha-solving-wait-and-verify/package.json](../../examples/typescript/captcha-solving-wait-and-verify/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.21.0` |
| `@browserbasehq/stagehand` | `4.2.1` |
| `dotenv` | `^17.4.2` |
| `playwright-core` | `^1.58.2` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

| Check | Date | Runtime | Command | Result and limits |
| --- | --- | --- | --- | --- |
| Offline behavior tested | 2026-11-06 | `Node.js 24.19.0; npm 11.17.0; Stagehand 4.2.1` | `npm test` | passed. 10 synthetic tests; no browser or live CAPTCHA solving. Run from examples/typescript/captcha-solving-wait-and-verify. |
| Clean install verified | 2026-11-06 | `Node.js 24.19.0; npm 11.17.0; Stagehand 4.2.1` | `npm ci` | passed. Fresh disposable package directory using the committed lockfile; no browser session. |
| Typechecked | 2026-11-06 | `Node.js 24.19.0; npm 11.17.0; Stagehand 4.2.1` | `npm run typecheck` | passed. TypeScript 6.0.3 signatures only; no live CAPTCHA or site verification. |

- Offline-tested only; no live CAPTCHA provider or target-site solve verified.
- Creates billed sessions; proxies and Verified are optional, and Verified requires account access.
- One-page navigation gate; readiness must be tailored to the application. Reports failure rather than implementing human takeover.

## Provenance

Cookbook-authored example. Its reviewed source is included at the local paths above.

Related topics: [Browser configuration](../topics/browser-features.md), [Agents and human handoff](../topics/agents-and-human-handoff.md), [Testing and observability](../topics/testing-and-observability.md).
