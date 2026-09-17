# Qa Agent Demo

Reference workflow for qa agent demo; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** reference.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/qa-and-observability/browserbase/qa-agent-demo/qa-agent`.
- Languages: javascript, typescript.
- Frameworks: @browserbasehq/stagehand, ai, next.
- [Upstream setup and behavior](../../use-cases/qa-and-observability/browserbase/qa-agent-demo/README.md).
- [Dependency manifest `use-cases/qa-and-observability/browserbase/qa-agent-demo/qa-agent/package.json`](../../use-cases/qa-and-observability/browserbase/qa-agent-demo/qa-agent/package.json).
- [Dependency manifest `use-cases/qa-and-observability/browserbase/qa-agent-demo/buggy-app/package.json`](../../use-cases/qa-and-observability/browserbase/qa-agent-demo/buggy-app/package.json).
- [Source `use-cases/qa-and-observability/browserbase/qa-agent-demo/qa-agent/src/index.ts`](../../use-cases/qa-and-observability/browserbase/qa-agent-demo/qa-agent/src/index.ts).
- [Source `use-cases/qa-and-observability/browserbase/qa-agent-demo/qa-agent/src/approach-a/run.ts`](../../use-cases/qa-and-observability/browserbase/qa-agent-demo/qa-agent/src/approach-a/run.ts).
- [Source `use-cases/qa-and-observability/browserbase/qa-agent-demo/qa-agent/src/approach-b/run.ts`](../../use-cases/qa-and-observability/browserbase/qa-agent-demo/qa-agent/src/approach-b/run.ts).
- Original use-case taxonomy: qa-and-observability.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/qa-and-observability/browserbase/qa-agent-demo/qa-agent
npm install
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `APP_URL` | Recipe configuration. Configures the app url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/qa-and-observability/browserbase/qa-agent-demo/qa-agent/package.json](../../use-cases/qa-and-observability/browserbase/qa-agent-demo/qa-agent/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@ai-sdk/anthropic` | `4.0.46` |
| `@ai-sdk/openai` | `4.0.53` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `ai` | `7.0.87` |
| `dotenv` | `17.4.2` |
| `zod` | `4.5.4` |

### Additional manifest: `use-cases/qa-and-observability/browserbase/qa-agent-demo/buggy-app/package.json`

[Manifest](../../use-cases/qa-and-observability/browserbase/qa-agent-demo/buggy-app/package.json). Follow the documented setup path; these declarations are not merged with the primary manifest.

| Package | Declared version |
| --- | --- |
| `next` | `16.3.4` |
| `react` | `19.2.8` |
| `react-dom` | `19.2.8` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Start the target app in a separate terminal: from this working directory run cd ../buggy-app, npm install, then npm run dev. Set APP_URL to a target reachable by the Browserbase cloud browser; its default localhost:3000 does not expose your laptop to the cloud browser.
- npm start -- a selects primitives; npm start -- b selects the agent approach. Run one approach at a time. Model credentials and cloud browser access are required; live results and reported bug counts remain unverified.
- Each sibling package keeps its own dependency installation. The primary dependency table describes only the working directory above; additional manifests retain their separate declarations.
- Use Node 24.19.0 from the package .nvmrc; the selected Node 24 baseline is separate from dependency-installation and live-runtime verification.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Agents and human handoff](../topics/agents-and-human-handoff.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md), [Testing and observability](../topics/testing-and-observability.md).
