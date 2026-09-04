# Support

Private source-inspected example for support.

**Status:** legacy · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/sales-support-and-ops/browserbase/support`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/sales-support-and-ops/browserbase/support/README.md).
- [Dependency manifest `use-cases/sales-support-and-ops/browserbase/support/package.json`](../../use-cases/sales-support-and-ops/browserbase/support/package.json).
- [Source `use-cases/sales-support-and-ops/browserbase/support/main.ts`](../../use-cases/sales-support-and-ops/browserbase/support/main.ts).
- [Source `use-cases/sales-support-and-ops/browserbase/support/index.ts`](../../use-cases/sales-support-and-ops/browserbase/support/index.ts).
- Original use-case taxonomy: sales-support-and-ops.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/sales-support-and-ops/browserbase/support
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run start
```

## Environment

[Environment template](../../use-cases/sales-support-and-ops/browserbase/support/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/sales-support-and-ops/browserbase/support/package.json](../../use-cases/sales-support-and-ops/browserbase/support/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `@playwright/test` | `1.63.0` |
| `boxen` | `8.0.1` |
| `chalk` | `6.0.0` |
| `dotenv` | `17.4.2` |
| `playwright-core` | `1.63.0` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.
- The prompt asks for three results but the schema describes one object; multi-result output is not established. This is not a support-ticket workflow.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/sales-support-and-ops/browserbase/support) at commit `0000000000000000000000000000000000000000`.

Related topics: [Extraction and research](../topics/extraction-and-research.md).
