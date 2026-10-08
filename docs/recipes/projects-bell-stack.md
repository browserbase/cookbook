# BELL: the personal assistant stack 🔔

Ring the BELL and put your personal assistant to work.

Powered by Browserbase, Linq, Eve, Baselayer, 1Password, Visa, and Stripe via Link CLI.

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
pnpm --dir ../browsie install --frozen-lockfile
pnpm --dir ../browsie build:library
pnpm install --frozen-lockfile
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
| `OP_ACCOUNT` | [1Password](https://www.1password.dev/sdks/desktop-app-integrations). Selects the account for local desktop SDK authorization. Non-secret. | `Your account name` | Use the account display name or UUID; Bell must run on the same computer as the desktop app.. No default. |
| `OP_SERVICE_ACCOUNT_TOKEN` | [1Password](https://www.1password.dev/service-accounts/get-started). Enables hosted vault access and takes precedence over OP_ACCOUNT. Secret. | `<set-locally>` | Grant access only to the vaults needed by this assistant.. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `STAGEHAND_BROWSER` | Browsie. Selects automatic, local, or Browserbase browser mode. Non-secret. | `browserbase` | Must be auto, local, or browserbase. Default: `browserbase`. |
| `BELL_MODEL` | [OpenAI](https://platform.openai.com/docs/models). Selects Bell's agent model. Non-secret. | `gpt-5.6-sol` | Must be available to the configured OpenAI account.. Default: `gpt-5.6-sol`. |
| `BELL_DEMO_URL` | URL used by the demo starter button. Non-secret. | `https://example.com` | Use a site you are authorized to access.. Default: `https://example.com`. |
| `BROWSIE_LOG_SESSION` | Browserbase. Controls network logging in the shared browser runtime. Non-secret. | `false` | Must be false before starting a browser used for merchant credentials.. Default: `false`. |


## Dependencies

Declared runtime dependencies from [projects/bell-stack/package.json](../../projects/bell-stack/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@ai-sdk/openai` | `4.0.46` |
| `@browserbasehq/sdk` | `2.18.0` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `browsie` | `file:../browsie` |
| `eve` | `0.47.6` |
| `next` | `16.3.8` |
| `react` | `19.3.0` |
| `react-dom` | `19.3.0` |
| `zod` | `4.6.5` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

| Check | Date | Runtime | Command | Result and limits |
| --- | --- | --- | --- | --- |
| Offline behavior tested | 2026-10-08 | `Node.js 24.15.0; pnpm 10.33.4; Linux x64; Eve 0.47.6` | `pnpm install --frozen-lockfile && pnpm test && pnpm typecheck && pnpm lint && pnpm build` | passed. 4 projection tests passed. Frozen-lockfile installation, type checking, zero-warning lint, and Eve/Next compilation passed with the shared Browsie package built first. This stage does not include Baselayer presentation. Live agent and browser work are verified separately with the merchant integration. |

- Install from the cookbook checkout: the file:../browsie dependency requires its sibling package and a shared-library build.
- Bell owns its agent, interface, configuration, and integrations. It does not copy Browsie or call a separately deployed agent.
- The capture panel displays requested screenshots; interactive input uses the shared human-handoff tool.
- The local reference uses one demo operator. Production authentication and durable storage require configuration.
- Linq conversations use the same agent definition but have their own Eve sessions. Live Linq, 1Password login, and checkout were not tested.

## Provenance

Cookbook-authored example. Its reviewed source is included at the local paths above.

Related topics: [Agents and human handoff](../topics/agents-and-human-handoff.md), [Authentication and saved sessions](../topics/authentication.md), [Browser configuration](../topics/browser-features.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md), [Testing and observability](../topics/testing-and-observability.md).
