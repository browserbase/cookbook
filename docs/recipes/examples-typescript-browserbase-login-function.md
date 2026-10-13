# Browserbase login with Functions and Secrets (TypeScript)

Deploy a Stagehand email/password login as a Browserbase Function with attached Secrets and a structured dashboard check.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · typechecked.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/typescript/browserbase-login-function`.
- Languages: typescript.
- Frameworks: Stagehand, Playwright, Browserbase Functions.
- [Upstream setup and behavior](../../examples/typescript/browserbase-login-function/README.md).
- [Dependency manifest `examples/typescript/browserbase-login-function/package.json`](../../examples/typescript/browserbase-login-function/package.json).
- [Dependency manifest `examples/typescript/browserbase-login-function/package-lock.json`](../../examples/typescript/browserbase-login-function/package-lock.json).
- [Source `examples/typescript/browserbase-login-function/index.ts`](../../examples/typescript/browserbase-login-function/index.ts).
- Original use-case taxonomy: functions, secrets, stagehand-v4, login.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/typescript/browserbase-login-function
npm ci --ignore-scripts
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run dev
```

## Environment

[Environment template](../../examples/typescript/browserbase-login-function/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Connects to the Function-managed session and the Browserbase Model Gateway. Secret. | `<set-locally>` | Non-empty; attach as a Function Secret for deployed runs or set locally in .env. No default. |
| `BROWSERBASE_LOGIN_EMAIL` | [Browserbase](https://www.browserbase.com/settings). Email for the Browserbase account to sign into. Secret. | `<set-locally>` | Non-empty; attach as a Function Secret for deployed runs or set locally in .env. No default. |
| `BROWSERBASE_LOGIN_PASSWORD` | [Browserbase](https://www.browserbase.com/settings). Password for the Browserbase account to sign into. Secret. | `<set-locally>` | Non-empty; attach as a Function Secret for deployed runs or set locally in .env. No default. |


## Dependencies

Declared runtime dependencies from [examples/typescript/browserbase-login-function/package.json](../../examples/typescript/browserbase-login-function/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk-functions` | `1.0.3` |
| `@browserbasehq/stagehand` | `4.1.0` |
| `dotenv` | `^16.4.5` |
| `playwright-core` | `1.55.0` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

| Check | Date | Runtime | Command | Result and limits |
| --- | --- | --- | --- | --- |
| Clean install verified | 2026-10-13 | `Node.js 24.19.0; npm 11.17.0; package-lock.json` | `cd examples/typescript/browserbase-login-function && npm ci --ignore-scripts` | passed. Fresh package dependency tree installed; does not establish hosted build or login behavior. |
| Typechecked | 2026-10-13 | `TypeScript 7.0.2; Stagehand 4.1.0; sdk-functions 1.0.3` | `cd examples/typescript/browserbase-login-function && npm run typecheck` | passed. Static validation only; successful login, MFA, and account identity are not verified. |

- Supports email/password and Browserbase Okta password selection. Google sign-in and other identity providers are unsupported; any required MFA must be completed by the user.
- Upload the matching Stagehand extension and set its project-specific ID in index.ts before publishing.
- Attach the API key, login email, and password Secrets to the deployed Function; local dev uses .env.
- Session recording and default Stagehand logging are enabled; browser session logging is disabled. Replays and page content can include account identifiers.
- Dashboard verification is an AI assessment, not a server-side authentication or identity assertion. Successful login has not been verified.

## Provenance

Cookbook-authored example. Its reviewed source is included at the local paths above.

Related topics: [Authentication and saved sessions](../topics/authentication.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md).
