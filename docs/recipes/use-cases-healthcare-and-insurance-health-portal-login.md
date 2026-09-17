# Health portal login

Reference workflow for health portal login; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** legacy · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/healthcare-and-insurance/health-portal-login`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/healthcare-and-insurance/health-portal-login/README.md).
- [Dependency manifest `use-cases/healthcare-and-insurance/health-portal-login/package.json`](../../use-cases/healthcare-and-insurance/health-portal-login/package.json).
- [Source `use-cases/healthcare-and-insurance/health-portal-login/main.ts`](../../use-cases/healthcare-and-insurance/health-portal-login/main.ts).
- [Source `use-cases/healthcare-and-insurance/health-portal-login/index.ts`](../../use-cases/healthcare-and-insurance/health-portal-login/index.ts).
- Original use-case taxonomy: healthcare-and-insurance.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/healthcare-and-insurance/health-portal-login
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run start
```

## Environment

[Environment template](../../use-cases/healthcare-and-insurance/health-portal-login/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `HEALTH_PORTAL_PASSWORD` | Recipe configuration. Provides the health portal password credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `HEALTH_PORTAL_USERNAME` | Recipe configuration. Provides the health portal username credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/healthcare-and-insurance/health-portal-login/package.json](../../use-cases/healthcare-and-insurance/health-portal-login/package.json). Alternate manifests may differ; use the documented setup path.

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

- The workflow stops after a login check based on a heading selector. It does not verify insurance eligibility or benefits.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Authentication and saved sessions](../topics/authentication.md).
