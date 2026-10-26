# Authenticated Fetch (TypeScript)

Save a browser login in a context, then fetch protected HTML, Markdown, or structured JSON with an environment-provided context ID.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · live workflow tested.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/typescript/authenticated-fetch`.
- Languages: typescript.
- Frameworks: Browserbase SDK, Playwright.
- [Upstream setup and behavior](../../examples/typescript/authenticated-fetch/README.md).
- [Dependency manifest `examples/typescript/authenticated-fetch/package.json`](../../examples/typescript/authenticated-fetch/package.json).
- [Source `examples/typescript/authenticated-fetch/login.ts`](../../examples/typescript/authenticated-fetch/login.ts).
- [Source `examples/typescript/authenticated-fetch/index.ts`](../../examples/typescript/authenticated-fetch/index.ts).
- Original use-case taxonomy: fetch, contexts, cookies.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/typescript/authenticated-fetch
corepack enable
pnpm install --config.minimumReleaseAge=10080
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
pnpm login
pnpm start
pnpm start markdown
pnpm start json
```

## Environment

[Environment template](../../examples/typescript/authenticated-fetch/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_CONTEXT_ID` | [Browserbase](https://www.browserbase.com/settings). Saved context ID printed by pnpm login; required for Fetch, optional for login. Non-secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [examples/typescript/authenticated-fetch/package.json](../../examples/typescript/authenticated-fetch/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `dotenv` | `^16.4.5` |
| `playwright-core` | `1.56.1` |

## Caveats and verification

Source and setup metadata were inspected. A scoped live workflow check is recorded below; only its stated command, date, result, and limits are verified. Other websites, accounts, permissions, costs, and configurations remain unverified.

| Check | Date | Runtime | Command | Result and limits |
| --- | --- | --- | --- | --- |
| Typechecked | 2026-10-19 | `Node.js 24.19.0; pnpm 10.24.0; TypeScript 7.0.2; Browserbase SDK 2.19.1; playwright-core 1.56.1` | `pnpm typecheck` | passed. Local compilation only; authenticated browser and Fetch workflow not live-tested. |
| Live workflow tested | 2026-10-19 | `Node.js 24.19.0; Browserbase SDK 2.19.1; playwright-core 1.56.1` | `node --import tsx login.ts; BROWSERBASE_CONTEXT_ID=<saved-context> node --import tsx index.ts raw (also markdown and json)` | failed. Login and completed-session persistence verified in a second browser session without login. Anonymous Fetch returned a login page with HTTP 200. Context Fetch returned HTTP 400: not enabled for this project, before extraction. Full E2E remains blocked. |
| Live workflow tested | 2026-10-19 | `Node.js 24.19.0; Browserbase SDK 2.19.1; playwright-core 1.56.1` | `BROWSERBASE_CONTEXT_ID=<saved-context> node --import tsx index.ts raw; repeat with markdown and json` | passed. Reused the context from the verified browser login and completed session. All three formats passed protected-content checks and saved output. Applies to the tested project and public demo; does not establish general feature availability. |
| Live workflow tested | 2026-10-26 | `Node.js; Browserbase SDK 2.19.1; playwright-core 1.56.1` | `node --import tsx login.ts; BROWSERBASE_CONTEXT_ID=<new-context> node --import tsx index.ts raw (also markdown and json)` | passed. Fresh login and completed session followed by protected-content checks for HTML, Markdown, and JSON. Applies to the tested project and public demo. |

- Draft: requires a project enabled for launch-gated Fetch context support.
- Uses public demo credentials; adapt login and protected-content checks for your own site.
- Fetch uses saved cookies only; JavaScript-only authentication requires a browser.
- Live login, persisted context reuse, and authenticated Fetch in all three formats verified on 2026-10-19 for the tested project.
- Documentation: [Authenticated Fetch](https://docs.browserbase.com/platform/fetch/authenticated-fetch).

## Provenance

Cookbook-authored example. Its reviewed source is included at the local paths above.

Related topics: [Authentication and saved sessions](../topics/authentication.md), [Extraction and research](../topics/extraction-and-research.md).
