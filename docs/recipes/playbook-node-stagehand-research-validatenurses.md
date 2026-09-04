# Validate nurses (TypeScript, Stagehand)

Demonstrate validate nurses with Stagehand/Browserbase SDK.

**Status:** current · public · live workflow tested.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `playbook/node`.
- Languages: typescript.
- Frameworks: Stagehand, Browserbase SDK.
- [Upstream setup and behavior](../../playbook/node/README.md).
- [Dependency manifest `playbook/node/package.json`](../../playbook/node/package.json).
- [Source `playbook/node/stagehand/research/validateNurses.ts`](../../playbook/node/stagehand/research/validateNurses.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd playbook/node
npm install
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npx tsx stagehand/research/validateNurses.ts
```

## Environment

[Environment template](../../playbook/node/stagehand/research/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `GOOGLE_API_KEY` | [Google AI](https://aistudio.google.com/apikey). Authenticates requests to Google AI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


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

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

| Check | Date | Runtime | Command | Result and limits |
| --- | --- | --- | --- | --- |
| Live workflow tested | 2026-09-08 | `Node 24.19.0 or Python 3.13.2; live Browserbase project` | `npx tsx stagehand/research/validateNurses.ts` | passed. Live Stagehand session completed the public license lookup and extraction. |

- Browserbase Playbook snapshot; inspect hardcoded URLs, credentials, IDs, and site-specific assumptions before use.
- The shared Node package declares Stagehand 4.0.2 and the Stagehand scripts use migrated factory APIs. Live workflow behavior remains unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/playbook/tree/001362e91bf6af47c03f16258cb1126e2043bff1/node/stagehand/research/validateNurses.ts) at commit `001362e91bf6af47c03f16258cb1126e2043bff1`.

Related topics: [Extraction and research](../topics/extraction-and-research.md), [Business operations](../topics/business-operations.md).
