# Qa

Reference workflow for qa; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** legacy · source inspected.

**Recipe type:** reference.
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

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Legacy Stagehand dependency ^3.0.0; migration needed before claiming current SDK compatibility.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Agents and human handoff](../topics/agents-and-human-handoff.md), [Testing and observability](../topics/testing-and-observability.md).
