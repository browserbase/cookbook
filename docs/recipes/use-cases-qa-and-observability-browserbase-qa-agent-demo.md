# Qa Agent Demo

Private source-inspected example for qa agent demo.

**Status:** current · private · source inspected.

**Recipe type:** runnable example.
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

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm start -- a
```

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

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

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.
- Start the target app in a separate terminal: from this working directory run cd ../buggy-app, npm install, then npm run dev. Set APP_URL to a target reachable by the Browserbase cloud browser; its default localhost:3000 does not expose your laptop to the cloud browser.
- npm start -- a selects primitives; npm start -- b selects the agent approach. Run one approach at a time. Model credentials and cloud browser access are required; live results and reported bug counts remain unverified.
- Each sibling package keeps its own dependency installation. The primary dependency table describes only the working directory above; additional manifests retain their separate declarations.
- Use Node 24.19.0 from the package .nvmrc; the selected Node 24 baseline is separate from dependency-installation and live-runtime verification.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/qa-and-observability/browserbase/qa-agent-demo) at commit `0000000000000000000000000000000000000000`.

Related topics: [Agents and human handoff](../topics/agents-and-human-handoff.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md), [Testing and observability](../topics/testing-and-observability.md).
