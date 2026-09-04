# Ui Debug Bench

Private source-inspected example for ui debug bench.

**Status:** legacy · private · source inspected.

**Recipe type:** reusable snippet.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/qa-and-observability/browserbase/ui-debug-bench`.
- Languages: javascript, shell, typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/qa-and-observability/browserbase/ui-debug-bench/README.md).
- [Dependency manifest `use-cases/qa-and-observability/browserbase/ui-debug-bench/package.json`](../../use-cases/qa-and-observability/browserbase/ui-debug-bench/package.json).
- [Source `use-cases/qa-and-observability/browserbase/ui-debug-bench/src/interfaces/index.ts`](../../use-cases/qa-and-observability/browserbase/ui-debug-bench/src/interfaces/index.ts).
- [Source `use-cases/qa-and-observability/browserbase/ui-debug-bench/src/cli.ts`](../../use-cases/qa-and-observability/browserbase/ui-debug-bench/src/cli.ts).
- Original use-case taxonomy: qa-and-observability.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/qa-and-observability/browserbase/ui-debug-bench
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/qa-and-observability/browserbase/ui-debug-bench/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | [Google AI](https://aistudio.google.com/apikey). Authenticates requests to Google AI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `STRIPE_SECRET_KEY` | [Stripe](https://dashboard.stripe.com/test/apikeys). Provides the stripe secret key credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSE_CDP` | Recipe configuration. Configures browse cdp behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BROWSE_CDP_LAUNCH_TIMEOUT_MS` | Recipe configuration. Configures browse cdp launch timeout ms behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `BROWSE_CDP_PORT` | Recipe configuration. Configures browse cdp port behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `BROWSE_CHROME` | Recipe configuration. Configures browse chrome behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BROWSE_CMD` | Recipe configuration. Configures browse cmd behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BROWSE_TARGET` | Recipe configuration. Configures browse target behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `CLAUDE_MODEL` | Recipe configuration. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `CLAUDE_TIMEOUT_MS` | Recipe configuration. Configures claude timeout ms behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `DATABASE_URL` | Recipe configuration. Configures the database url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |
| `INSTALL_TIMEOUT_MS` | Recipe configuration. Configures install timeout ms behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `KEEP_WORKSPACES` | Recipe configuration. Configures keep workspaces behavior for this recipe. Non-secret. | `false` | Use the format described by the recipe. No default. |
| `NODE_ENV` | Recipe configuration. Configures node env behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `SERVER_START_TIMEOUT_MS` | Recipe configuration. Configures server start timeout ms behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `STAGEHAND_CALL_TIMEOUT_MS` | Stagehand. Configures stagehand call timeout ms behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `STAGEHAND_CONNECT_TIMEOUT_MS` | Stagehand. Configures stagehand connect timeout ms behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `STAGEHAND_ENV` | Stagehand. Configures stagehand env behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `STAGEHAND_LLM_TIMEOUT_MS` | Stagehand. Configures stagehand llm timeout ms behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `STAGEHAND_MODEL` | Stagehand. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `STAGEHAND_NAV_TIMEOUT_MS` | Stagehand. Configures stagehand nav timeout ms behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `VALIDATE_TIMEOUT_MS` | Recipe configuration. Configures validate timeout ms behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/qa-and-observability/browserbase/ui-debug-bench/package.json](../../use-cases/qa-and-observability/browserbase/ui-debug-bench/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@anthropic-ai/sdk` | `0.124.0` |
| `@browserbasehq/stagehand` | `4.0.2` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Legacy Stagehand dependency ^3.4.0; migration needed before claiming current SDK compatibility.
- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/qa-and-observability/browserbase/ui-debug-bench) at commit `0000000000000000000000000000000000000000`.

Related topics: [Testing and observability](../topics/testing-and-observability.md).
