# Browserbase Demo

Private source-inspected example for browserbase demo.

**Status:** current · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/sales-support-and-ops/sample-05/browserbase-demo`.
- Languages: typescript.
- Frameworks: @elevenlabs/react, next.
- [Upstream setup and behavior](../../use-cases/sales-support-and-ops/sample-05/browserbase-demo/README.md).
- [Dependency manifest `use-cases/sales-support-and-ops/sample-05/browserbase-demo/package.json`](../../use-cases/sales-support-and-ops/sample-05/browserbase-demo/package.json).
- [Source `use-cases/sales-support-and-ops/sample-05/browserbase-demo/app/api/demo/stream/route.ts`](../../use-cases/sales-support-and-ops/sample-05/browserbase-demo/app/api/demo/stream/route.ts).
- [Source `use-cases/sales-support-and-ops/sample-05/browserbase-demo/app/api/demo/control/route.ts`](../../use-cases/sales-support-and-ops/sample-05/browserbase-demo/app/api/demo/control/route.ts).
- [Source `use-cases/sales-support-and-ops/sample-05/browserbase-demo/app/api/demo/session/route.ts`](../../use-cases/sales-support-and-ops/sample-05/browserbase-demo/app/api/demo/session/route.ts).
- Original use-case taxonomy: sales-support-and-ops.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/sales-support-and-ops/sample-05/browserbase-demo
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run dev
npm run start
```

## Environment

[Environment template](../../use-cases/sales-support-and-ops/sample-05/browserbase-demo/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

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

Declared runtime dependencies from [use-cases/sales-support-and-ops/sample-05/browserbase-demo/package.json](../../use-cases/sales-support-and-ops/sample-05/browserbase-demo/package.json). Alternate manifests may differ; use the documented setup path.

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

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/sales-support-and-ops/sample-05/browserbase-demo) at commit `0000000000000000000000000000000000000000`.

Related topics: [Agents and human handoff](../topics/agents-and-human-handoff.md), [Business operations](../topics/business-operations.md).
