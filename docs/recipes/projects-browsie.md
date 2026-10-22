# Browsie: consumer browser agent

Build a durable consumer browser agent with Stagehand code mode, Browserbase Contexts, Live View and replay, vaults, payments, a desktop app, MCP, and a web workbench.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · offline behavior tested.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `projects/browsie`.
- Languages: typescript.
- Frameworks: Stagehand, Browserbase SDK, Eve, Next.js, Electron, MCP.
- [Upstream setup and behavior](../../projects/browsie/README.md).
- [Dependency manifest `projects/browsie/package.json`](../../projects/browsie/package.json).
- [Dependency manifest `projects/browsie/desktop/package.json`](../../projects/browsie/desktop/package.json).
- [Source `projects/browsie/app/page.tsx`](../../projects/browsie/app/page.tsx).
- [Source `projects/browsie/agent/agent.ts`](../../projects/browsie/agent/agent.ts).
- [Source `projects/browsie/desktop/electron/main.cjs`](../../projects/browsie/desktop/electron/main.cjs).
- [Source `projects/browsie/desktop/mcp/server.ts`](../../projects/browsie/desktop/mcp/server.ts).
- Original use-case taxonomy: reference-app.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd projects/browsie
pnpm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
pnpm dev
```

## Environment

[Environment template](../../projects/browsie/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Runs the Eve agent model. Secret. | `<set-locally>` | Must be a valid OpenAI API key. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Creates hosted sessions, Contexts, Live View links, proxies, and Verified Browsers. Secret. | `<set-locally>` | Required when STAGEHAND_BROWSER is browserbase. No default. |
| `BROWSIE_HANDOFF_SECRET` | Browsie. Signs short-lived human-handoff links. Secret. | `<random-32-or-more-character-value>` | Use a random value with at least 32 characters. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `STAGEHAND_BROWSER` | Browsie. Selects automatic, local, or Browserbase browser mode. Non-secret. | `browserbase` | Must be auto, local, or browserbase. Default: `auto`. |
| `BROWSIE_MODEL` | [OpenAI](https://platform.openai.com/docs/models). Selects the model used by the Eve agent. Non-secret. | `gpt-5.6-sol` | Must be a model available to the configured OpenAI account. Default: `gpt-5.6-sol`. |
| `LINK_ACCESS_TOKEN` | [Stripe Link](https://docs.stripe.com/agentic-commerce/link-agentic-commerce). Connects a server-side Link Agent Wallet for approved browser checkout. Secret. | `<set-locally>` | Must be a valid Link Agent Wallet access token. No default. |


## Dependencies

Declared runtime dependencies from [projects/browsie/package.json](../../projects/browsie/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@1password/sdk` | `0.5.0` |
| `@ai-sdk/openai` | `4.0.93` |
| `@browserbasehq/sdk` | `2.21.0` |
| `@browserbasehq/stagehand` | `4.2.1` |
| `@stripe/link-integrations-eve` | `0.3.0` |
| `@stripe/link-sdk` | `0.12.0` |
| `ai` | `7.0.139` |
| `dotenv` | `^17.4.2` |
| `eve` | `0.66.3` |
| `hls.js` | `^1.7.1` |
| `lucide-react` | `^1.60.0` |
| `next` | `16.4.0` |
| `react` | `^19.3.1` |
| `react-dom` | `^19.3.1` |
| `zod` | `4.4.3` |

### Additional manifest: `projects/browsie/desktop/package.json`

[Manifest](../../projects/browsie/desktop/package.json). Follow the documented setup path; these declarations are not merged with the primary manifest.

| Package | Declared version |
| --- | --- |
| `@modelcontextprotocol/sdk` | `1.32.1` |
| `dotenv` | `18.0.8` |
| `eve` | `0.66.3` |
| `zod` | `4.6.7` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

| Check | Date | Runtime | Command | Result and limits |
| --- | --- | --- | --- | --- |
| Offline behavior tested | 2026-10-20 | `Node.js 25.9.0 with pnpm 10.33.0 on macOS arm64; package target is Node.js 24.x` | `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm desktop:test && pnpm desktop:typecheck && pnpm desktop:build` | passed. 98 unit tests and 2 desktop package tests passed; 8 credential-dependent live tests skipped. The Next.js and Eve production builds, Electron package build, packaged MCP command smoke test, and authenticated HTTP MCP smoke test passed. No live Browserbase, model, Linq, 1Password, or Link payment call was made. |

- Local Context metadata and native-vault data use local files and need a durable database for a multi-instance deployment.
- Handoff links expire but are not single-use links.
- Live integration tests use billable external services and skip without explicit credentials.

## Provenance

Cookbook-authored example. Its reviewed source is included at the local paths above.

Related topics: [Agents and human handoff](../topics/agents-and-human-handoff.md), [Authentication and saved sessions](../topics/authentication.md), [Browser configuration](../topics/browser-features.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md), [Testing and observability](../topics/testing-and-observability.md).
