# Wait for CAPTCHA solving and verify access

Wait for CAPTCHA solving with Stagehand v4, verify application readiness, and revisit the original URL at most once

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · typechecked.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/typescript/captcha-solving-wait-and-verify`.
- Languages: typescript.
- Frameworks: Stagehand.
- [Upstream setup and behavior](../../examples/typescript/captcha-solving-wait-and-verify/README.md).
- [Dependency manifest `examples/typescript/captcha-solving-wait-and-verify/package.json`](../../examples/typescript/captcha-solving-wait-and-verify/package.json).
- [Dependency manifest `examples/typescript/captcha-solving-wait-and-verify/pnpm-lock.yaml`](../../examples/typescript/captcha-solving-wait-and-verify/pnpm-lock.yaml).
- [Source `examples/typescript/captcha-solving-wait-and-verify/stagehand.ts`](../../examples/typescript/captcha-solving-wait-and-verify/stagehand.ts).
- Original use-case taxonomy: stagehand-v4, captcha, readiness.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/typescript/captcha-solving-wait-and-verify
pnpm install --frozen-lockfile
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
pnpm start
```

## Environment

[Environment template](../../examples/typescript/captcha-solving-wait-and-verify/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticate Browserbase sessions Secret. | `<set-locally>` | Nonempty value. No default. |
| `TARGET_URL` | Application. Authorized page to navigate to and revisit once Non-secret. | `<set-locally>` | Nonempty value. No default. |
| `EXPECTED_SELECTOR` | Application. Unique CSS selector for post-challenge content Non-secret. | `<set-locally>` | Nonempty value. No default. |


## Dependencies

Declared runtime dependencies from [examples/typescript/captcha-solving-wait-and-verify/package.json](../../examples/typescript/captcha-solving-wait-and-verify/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/stagehand` | `4.2.1` |
| `dotenv` | `^17.4.2` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

| Check | Date | Runtime | Command | Result and limits |
| --- | --- | --- | --- | --- |
| Typechecked | 2026-11-06 | `Node.js 24.19.0; pnpm 11.22.0; Stagehand 4.2.1` | `pnpm typecheck` | passed. TypeScript 6.0.3 signatures only; no live CAPTCHA or site verification. |

- Typechecked only; no live CAPTCHA provider or target-site solve verified.
- Creates billed sessions; proxies and Verified are optional, and Verified requires account access.
- One-page navigation gate; readiness must be tailored to the application. Reports failure rather than implementing human takeover.

## Provenance

Cookbook-authored example. Its reviewed source is included at the local paths above.

Related topics: [Browser configuration](../topics/browser-features.md), [Agents and human handoff](../topics/agents-and-human-handoff.md), [Testing and observability](../topics/testing-and-observability.md).
