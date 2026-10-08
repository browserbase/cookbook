# Bell-Stack: personal assistant foundation

Build a personal assistant from Browsie with one Eve conversation, a persistent Browserbase browser, Linq messaging, and optional 1Password access.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · offline behavior tested.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `projects/bell-stack`.
- Languages: typescript.
- Frameworks: Stagehand, Browserbase SDK, Eve, Next.js.
- [Upstream setup and behavior](../../projects/bell-stack/README.md).
- [Dependency manifest `projects/bell-stack/package.json`](../../projects/bell-stack/package.json).
- [Source `projects/bell-stack/app/page.tsx`](../../projects/bell-stack/app/page.tsx).
- [Source `projects/bell-stack/agent/agent.ts`](../../projects/bell-stack/agent/agent.ts).
- Original use-case taxonomy: reference-app.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd projects/bell-stack
pnpm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
pnpm dev
```

## Environment

[Environment template](../../projects/bell-stack/.env.example) lists example configuration. Fill in your own values locally.

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


## Dependencies

Declared runtime dependencies from [projects/bell-stack/package.json](../../projects/bell-stack/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@1password/sdk` | `0.5.0` |
| `@ai-sdk/openai` | `4.0.46` |
| `@browserbasehq/sdk` | `2.18.0` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `ai` | `7.0.82` |
| `dotenv` | `^17.2.0` |
| `eve` | `0.47.6` |
| `lucide-react` | `^1.34.0` |
| `next` | `16.3.8` |
| `react` | `^19.2.0` |
| `react-dom` | `^19.2.0` |
| `zod` | `^4.4.0` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

| Check | Date | Runtime | Command | Result and limits |
| --- | --- | --- | --- | --- |
| Offline behavior tested | 2026-10-07 | `Node.js 24.15.0; pnpm 10.33.4; Linux x64; Eve 0.47.6; Stagehand 4.0.2; Browserbase SDK 2.18.0` | `pnpm install --frozen-lockfile && pnpm test && pnpm typecheck && pnpm lint && pnpm test:linq-local && pnpm build` | passed. 88 tests passed, including 4 React lifecycle regression tests; 7 opt-in live tests skipped in the default suite. Type checking covers server modules and TSX tests. Lint passed with zero warnings and errors. Frozen-lockfile installation, Eve and Next.js compilation, and the Linq parser self-test passed. Live Context login, Linq delivery, 1Password, and payment checkout were not tested. Production startup/authentication and durable storage still require configuration. |

- Local Context metadata and native-vault data use local files and need a durable database for a multi-instance deployment.
- Handoff links expire but are not single-use links.
- Live integration tests use billable external services and skip without explicit credentials.
- The foundation retains Browsie UI labels and configuration names.
- Production hosting requires application authentication and durable storage; local demo validation does not establish production readiness.

## Provenance

Cookbook-authored example. Its reviewed source is included at the local paths above.

Related topics: [Agents and human handoff](../topics/agents-and-human-handoff.md), [Authentication and saved sessions](../topics/authentication.md), [Browser configuration](../topics/browser-features.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md), [Testing and observability](../topics/testing-and-observability.md).
