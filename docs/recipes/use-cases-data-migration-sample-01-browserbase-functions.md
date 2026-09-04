# Browserbase Functions

Private source-inspected example for browserbase functions.

**Status:** current · private · source inspected.

**Recipe type:** reusable snippet.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/data-migration/sample-01/browserbase-functions`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/data-migration/sample-01/browserbase-functions/README.md).
- [Dependency manifest `use-cases/data-migration/sample-01/browserbase-functions/package.json`](../../use-cases/data-migration/sample-01/browserbase-functions/package.json).
- [Source `use-cases/data-migration/sample-01/browserbase-functions/shared/agent.ts`](../../use-cases/data-migration/sample-01/browserbase-functions/shared/agent.ts).
- Original use-case taxonomy: data-migration.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/data-migration/sample-01/browserbase-functions
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/data-migration/sample-01/browserbase-functions/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `SQUARE_CLIENT_PACKAGES_CONTEXT_ID` | Recipe configuration. Selects a saved browser context for this workflow. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `SQUARE_CUSTOMER_NOTES_CONTEXT_ID` | Recipe configuration. Selects a saved browser context for this workflow. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/data-migration/sample-01/browserbase-functions/package.json](../../use-cases/data-migration/sample-01/browserbase-functions/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@ai-sdk/openai` | `4.0.59` |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/sdk-functions` | `1.0.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `ai` | `7.0.93` |
| `playwright-core` | `1.63.0` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/data-migration/sample-01/browserbase-functions) at commit `0000000000000000000000000000000000000000`.

Related topics: [Extraction and research](../topics/extraction-and-research.md), [Agents and human handoff](../topics/agents-and-human-handoff.md), [Business operations](../topics/business-operations.md).
