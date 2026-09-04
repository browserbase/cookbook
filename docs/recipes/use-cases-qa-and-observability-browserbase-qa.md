# Qa

Private source-inspected example for qa.

**Status:** legacy · private · source inspected.

**Recipe type:** reusable snippet.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/qa-and-observability/browserbase/qa`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/qa-and-observability/browserbase/qa/README.md).
- [Dependency manifest `use-cases/qa-and-observability/browserbase/qa/package.json`](../../use-cases/qa-and-observability/browserbase/qa/package.json).
- [Source `use-cases/qa-and-observability/browserbase/qa/qa-agent-demo.ts`](../../use-cases/qa-and-observability/browserbase/qa/qa-agent-demo.ts).
- [Source `use-cases/qa-and-observability/browserbase/qa/self-healing-demo.ts`](../../use-cases/qa-and-observability/browserbase/qa/self-healing-demo.ts).
- [Source `use-cases/qa-and-observability/browserbase/qa/dynamic-form-validation.ts`](../../use-cases/qa-and-observability/browserbase/qa/dynamic-form-validation.ts).
- Original use-case taxonomy: qa-and-observability.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/qa-and-observability/browserbase/qa
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/qa-and-observability/browserbase/qa/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/qa-and-observability/browserbase/qa/package.json](../../use-cases/qa-and-observability/browserbase/qa/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@ai-sdk/openai` | `4.0.59` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `ai` | `7.0.93` |
| `dotenv` | `17.4.2` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Legacy Stagehand dependency ^3.0.0; migration needed before claiming current SDK compatibility.
- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/qa-and-observability/browserbase/qa) at commit `0000000000000000000000000000000000000000`.

Related topics: [Agents and human handoff](../topics/agents-and-human-handoff.md), [Testing and observability](../topics/testing-and-observability.md).
