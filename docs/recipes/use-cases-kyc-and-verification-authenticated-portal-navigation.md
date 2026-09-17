# Authenticated portal navigation

Reference workflow for authenticated portal navigation; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** legacy · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/kyc-and-verification/authenticated-portal-navigation`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/kyc-and-verification/authenticated-portal-navigation/README.md).
- [Dependency manifest `use-cases/kyc-and-verification/authenticated-portal-navigation/package.json`](../../use-cases/kyc-and-verification/authenticated-portal-navigation/package.json).
- [Source `use-cases/kyc-and-verification/authenticated-portal-navigation/main.ts`](../../use-cases/kyc-and-verification/authenticated-portal-navigation/main.ts).
- [Source `use-cases/kyc-and-verification/authenticated-portal-navigation/index.ts`](../../use-cases/kyc-and-verification/authenticated-portal-navigation/index.ts).
- Original use-case taxonomy: kyc-and-verification.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/kyc-and-verification/authenticated-portal-navigation
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run start
```

## Environment

[Environment template](../../use-cases/kyc-and-verification/authenticated-portal-navigation/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `HEALTH_PORTAL_PASSWORD` | Recipe configuration. Provides the health portal password credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `HEALTH_PORTAL_USERNAME` | Recipe configuration. Provides the health portal username credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `MEMBER_PORTAL_PASSWORD` | Recipe configuration. Provides the member portal password credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `MEMBER_PORTAL_USERNAME` | Recipe configuration. Provides the member portal username credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/kyc-and-verification/authenticated-portal-navigation/package.json](../../use-cases/kyc-and-verification/authenticated-portal-navigation/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `@playwright/test` | `1.63.0` |
| `boxen` | `8.0.1` |
| `chalk` | `6.0.0` |
| `dotenv` | `17.4.2` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- The active flow retrieves member identifiers only; insurance eligibility and benefits verification are not implemented. The target service portal flow is commented out.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Authentication and saved sessions](../topics/authentication.md), [Agents and human handoff](../topics/agents-and-human-handoff.md).
