# Tax Portal

Private source-inspected example for tax portal.

**Status:** legacy · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/government-and-public-records/sample-03/tax-portal`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/government-and-public-records/sample-03/tax-portal/README.md).
- [Dependency manifest `use-cases/government-and-public-records/sample-03/tax-portal/package.json`](../../use-cases/government-and-public-records/sample-03/tax-portal/package.json).
- [Source `use-cases/government-and-public-records/sample-03/tax-portal/server.ts`](../../use-cases/government-and-public-records/sample-03/tax-portal/server.ts).
- [Source `use-cases/government-and-public-records/sample-03/tax-portal/automate.ts`](../../use-cases/government-and-public-records/sample-03/tax-portal/automate.ts).
- [Source `use-cases/government-and-public-records/sample-03/tax-portal/automate-local.ts`](../../use-cases/government-and-public-records/sample-03/tax-portal/automate-local.ts).
- [Source `use-cases/government-and-public-records/sample-03/tax-portal/setup-gmail-context.ts`](../../use-cases/government-and-public-records/sample-03/tax-portal/setup-gmail-context.ts).
- Original use-case taxonomy: government-and-public-records.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/government-and-public-records/sample-03/tax-portal
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run dev
```

## Environment

[Environment template](../../use-cases/government-and-public-records/sample-03/tax-portal/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_CONTEXT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects a saved browser context for this workflow. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `FROM_EMAIL` | Recipe configuration. Provides the from email credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `GOOGLE_API_KEY` | [Google AI](https://aistudio.google.com/apikey). Authenticates requests to Google AI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `MODEL_API_KEY` | Recipe configuration. Authenticates requests to Recipe configuration. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `RESEND_API_KEY` | [Resend](https://resend.com/api-keys). Authenticates requests to Resend. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `USER_EMAIL` | Recipe configuration. Provides the user email credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `DEBUG` | Recipe configuration. Configures debug behavior for this recipe. Non-secret. | `false` | Use the format described by the recipe. No default. |
| `PORT` | Recipe configuration. Configures port behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `PORTAL_URL` | Recipe configuration. Configures the portal url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/government-and-public-records/sample-03/tax-portal/package.json](../../use-cases/government-and-public-records/sample-03/tax-portal/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `dotenv` | `17.4.2` |
| `express` | `5.2.1` |
| `playwright-core` | `1.63.0` |
| `resend` | `6.26.0` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Legacy Stagehand dependency ^1.13.0; migration needed before claiming current SDK compatibility.
- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/government-and-public-records/sample-03/tax-portal) at commit `0000000000000000000000000000000000000000`.

Related topics: [Authentication and saved sessions](../topics/authentication.md), [Business operations](../topics/business-operations.md).
