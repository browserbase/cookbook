# Live View special pointers (JavaScript)

Embed Browserbase Live View in a local page with matching human and agent pointers for Stagehand and Playwright actions.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · live workflow tested.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/javascript/live-view-cursor-ui`.
- Languages: javascript.
- Frameworks: Browserbase SDK, Stagehand, Playwright.
- [Upstream setup and behavior](../../examples/javascript/live-view-cursor-ui/README.md).
- [Dependency manifest `examples/javascript/live-view-cursor-ui/package.json`](../../examples/javascript/live-view-cursor-ui/package.json).
- [Source `examples/javascript/live-view-cursor-ui/server.mjs`](../../examples/javascript/live-view-cursor-ui/server.mjs).
- [Source `examples/javascript/live-view-cursor-ui/ui/app.js`](../../examples/javascript/live-view-cursor-ui/ui/app.js).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/javascript/live-view-cursor-ui
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm start
```

## Environment

[Environment template](../../examples/javascript/live-view-cursor-ui/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Creates and connects to the cloud browser session. Secret. | `<set-locally>` | Must be a valid Browserbase API key. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `LIVE_VIEW_UI_PORT` | Recipe configuration. Sets the localhost port for the pointer UI. Non-secret. | `4790` | Must be an available TCP port. Default: `4790`. |


## Dependencies

Declared runtime dependencies from [examples/javascript/live-view-cursor-ui/package.json](../../examples/javascript/live-view-cursor-ui/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.18.0` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `dotenv` | `^16.4.5` |
| `playwright-core` | `1.55.0` |

## Caveats and verification

Source and setup metadata were inspected. A scoped live workflow check is recorded below; only its stated command, date, result, and limits are verified. Other websites, accounts, permissions, costs, and configurations remain unverified.

| Check | Date | Runtime | Command | Result and limits |
| --- | --- | --- | --- | --- |
| Clean install verified | 2026-10-08 | `Node.js 25.9.0 and npm on macOS arm64` | `npm install --ignore-scripts --no-audit --no-fund --package-lock=false` | passed. Installed inside a new recipe directory without a shared dependency tree. This did not run a browser session. |
| Live workflow tested | 2026-10-08 | `Node.js 25.9.0 on macOS arm64; Browserbase SDK 2.18.0, Stagehand 4.0.2, Playwright Core 1.55.0` | `LIVE_VIEW_UI_PORT=4792 npm start; node /private/tmp/live-view-cursor-smoke.mjs playwright; node /private/tmp/live-view-cursor-smoke.mjs stagehand` | passed. One Browserbase SauceDemo session. Playwright emitted 6 pointer events and 3 clicks; Stagehand emitted 8 pointer events and 4 clicks. Both ended with the backpack in the cart. Human UI input and other browser clients were not retested in this checkout. The session was closed. |
| Live workflow tested | 2026-10-08 | `Node.js 25.9.0 on macOS arm64; Browserbase SDK 2.18.0 and Stagehand 4.0.2` | `env -u BROWSERBASE_PROJECT_ID LIVE_VIEW_UI_PORT=4793 npm start` | passed. The Browserbase and Stagehand session initialized with no project ID in the environment or launch options and was closed. This check did not rerun the Playwright or Stagehand cart actions. |

- The pointer styling appears in the localhost wrapper, not in a direct Browserbase Live View URL.
- The sample routes input and pointer events for the main browser tab only; new remote tabs and frames need more routing.
- The local server gives its signed Live View URL to its own page; keep the server bound to loopback and review access before deployment.

## Provenance

Cookbook-authored example. Its reviewed source is included at the local paths above.

Related topics: [Agents and human handoff](../topics/agents-and-human-handoff.md), [Testing and observability](../topics/testing-and-observability.md).
