# Trigger

Browserbase + Trigger.dev Integration

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `integrations/examples/integrations/trigger`.
- Languages: javascript, typescript.
- Frameworks: @trigger.dev/sdk, next.
- [Upstream setup and behavior](../../integrations/examples/integrations/trigger/README.md).
- [Dependency manifest `integrations/examples/integrations/trigger/package.json`](../../integrations/examples/integrations/trigger/package.json).
- [Source `integrations/examples/integrations/trigger/src/app/api/route.ts`](../../integrations/examples/integrations/trigger/src/app/api/route.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd integrations/examples/integrations/trigger
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run dev:tasks
npm run dev:web
```

## Environment

[Environment template](../../integrations/examples/integrations/trigger/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `R2_ACCESS_KEY_ID` | Cloudflare R2. Provides the r2 access key id credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2. Provides the r2 secret access key credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `RESEND_API_KEY` | [Resend](https://resend.com/api-keys). Authenticates requests to Resend. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `TRIGGER_SECRET_KEY` | [Trigger.dev](https://cloud.trigger.dev/). Provides the trigger secret key credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `S3_BUCKET` | S3-compatible storage. Configures s3 bucket behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `S3_ENDPOINT` | S3-compatible storage. Configures the s3 endpoint endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |
| `TRIGGER_PROJECT_REF` | [Trigger.dev](https://cloud.trigger.dev/). Configures trigger project ref behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [integrations/examples/integrations/trigger/package.json](../../integrations/examples/integrations/trigger/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@aws-sdk/client-s3` | `3.1127.0` |
| `@react-email/components` | `1.0.12` |
| `@react-email/render` | `2.1.0` |
| `@react-pdf/renderer` | `4.9.0` |
| `@trigger.dev/sdk` | `4.5.16` |
| `next` | `16.3.4` |
| `openai` | `7.10.0` |
| `puppeteer` | `25.10.0` |
| `puppeteer-core` | `24.43.1` |
| `react` | `19.2.4` |
| `react-dom` | `19.2.4` |
| `react-email` | `^4.0.16` |
| `resend` | `6.26.0` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Authenticate the Trigger CLI for your own TRIGGER_PROJECT_REF, then run dev:tasks and test puppeteer-log-title with {} in Development. dev:web only shows instructions. CLI 4.5.16 installation and an authenticated worker run remain unverified under the local package-age cutoff.

## Provenance

[Pinned upstream source](https://github.com/browserbase/integrations/tree/b7bc81c6fd4e089ab0c0df2b82529b200739e458/examples/integrations/trigger) at commit `b7bc81c6fd4e089ab0c0df2b82529b200739e458`.

Related topics: [Integrations and orchestration](../topics/integrations-and-orchestration.md).
