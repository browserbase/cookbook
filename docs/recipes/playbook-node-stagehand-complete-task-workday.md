# Workday (TypeScript, Stagehand)

Demonstrate workday with Stagehand/Browserbase SDK.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `playbook/node`.
- Languages: typescript.
- Frameworks: Stagehand, Browserbase SDK.
- [Upstream setup and behavior](../../playbook/node/README.md).
- [Dependency manifest `playbook/node/package.json`](../../playbook/node/package.json).
- [Source `playbook/node/stagehand/complete_task/workday.ts`](../../playbook/node/stagehand/complete_task/workday.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd playbook/node
npm install
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npx tsx stagehand/complete_task/workday.ts
```

## Environment

[Environment template](../../playbook/node/stagehand/complete_task/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_CONTEXT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects a saved browser context for this workflow. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `GOOGLE_API_KEY` | [Google AI](https://aistudio.google.com/apikey). Authenticates requests to Google AI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `WORKDAY_PASSWORD` | Recipe configuration. Provides the workday password credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `WORKDAY_USERNAME` | Recipe configuration. Provides the workday username credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `WORKDAY_ACCOUNT_SELECTOR` | Recipe configuration. Configures workday account selector behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `WORKDAY_AUTHENTICATED_URL` | Recipe configuration. Configures the workday authenticated url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |
| `WORKDAY_LOGIN_URL` | Recipe configuration. Configures the workday login url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [playbook/node/package.json](../../playbook/node/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@ai-sdk/anthropic` | `4.0.46` |
| `@browserbasehq/sdk` | `2.19.0` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `ai` | `7.0.86` |
| `axios` | `^1.8.1` |
| `boxen` | `^8.0.1` |
| `chalk` | `^5.3.0` |
| `dotenv` | `^16.4.7` |
| `jszip` | `3.10.1` |
| `open` | `11.0.2` |
| `playwright-core` | `1.62.1` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Browserbase Playbook snapshot; inspect hardcoded URLs, credentials, IDs, and site-specific assumptions before use.
- The shared Node package declares Stagehand 4.0.2 and the Stagehand scripts use migrated factory APIs. Live workflow behavior remains unverified.
- Requires explicit tenant login/protected URLs and an account-identity selector whose text matches WORKDAY_USERNAME. Native-login XPath selectors need tenant adaptation; saved contexts still require account verification.

## Provenance

[Pinned upstream source](https://github.com/browserbase/playbook/tree/001362e91bf6af47c03f16258cb1126e2043bff1/node/stagehand/complete_task/workday.ts) at commit `001362e91bf6af47c03f16258cb1126e2043bff1`.

Related topics: [Browser configuration](../topics/browser-features.md).
