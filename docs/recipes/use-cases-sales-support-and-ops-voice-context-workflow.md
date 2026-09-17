# Voice context workflow

Reference workflow for voice context workflow; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** reference.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/sales-support-and-ops/voice-context-workflow`.
- Languages: typescript.
- Frameworks: @elevenlabs/react, next.
- [Upstream setup and behavior](../../use-cases/sales-support-and-ops/voice-context-workflow/README.md).
- [Dependency manifest `use-cases/sales-support-and-ops/voice-context-workflow/package.json`](../../use-cases/sales-support-and-ops/voice-context-workflow/package.json).
- [Source `use-cases/sales-support-and-ops/voice-context-workflow/app/api/demo/stream/route.ts`](../../use-cases/sales-support-and-ops/voice-context-workflow/app/api/demo/stream/route.ts).
- [Source `use-cases/sales-support-and-ops/voice-context-workflow/app/api/demo/control/route.ts`](../../use-cases/sales-support-and-ops/voice-context-workflow/app/api/demo/control/route.ts).
- [Source `use-cases/sales-support-and-ops/voice-context-workflow/app/api/demo/session/route.ts`](../../use-cases/sales-support-and-ops/voice-context-workflow/app/api/demo/session/route.ts).
- Original use-case taxonomy: sales-support-and-ops.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/sales-support-and-ops/voice-context-workflow
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/sales-support-and-ops/voice-context-workflow/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSE_BIN` | Recipe configuration. Configures browse bin behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `NEXT_PUBLIC_VOICE_PROVIDER_AGENT_ID` | Recipe configuration. Configures next public target service agent id behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/sales-support-and-ops/voice-context-workflow/package.json](../../use-cases/sales-support-and-ops/voice-context-workflow/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@anthropic-ai/claude-agent-sdk` | `0.3.252` |
| `@browserbasehq/sdk` | `2.19.0` |
| `@elevenlabs/react` | `1.15.0` |
| `next` | `16.3.4` |
| `react` | `19.2.8` |
| `react-dom` | `19.2.8` |
| `zod` | `4.5.4` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Agents and human handoff](../topics/agents-and-human-handoff.md), [Business operations](../topics/business-operations.md).
