# Poc

Private source-inspected example for poc.

**Status:** legacy · private · source inspected.

**Recipe type:** reusable snippet.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/developer-tools-and-infra/browserbase/poc`.
- Languages: javascript, typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/developer-tools-and-infra/browserbase/poc/README.md).
- [Dependency manifest `use-cases/developer-tools-and-infra/browserbase/poc/package.json`](../../use-cases/developer-tools-and-infra/browserbase/poc/package.json).
- [Source `use-cases/developer-tools-and-infra/browserbase/poc/src/cli.ts`](../../use-cases/developer-tools-and-infra/browserbase/poc/src/cli.ts).
- Original use-case taxonomy: developer-tools-and-infra.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/developer-tools-and-infra/browserbase/poc
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/developer-tools-and-infra/browserbase/poc/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `STAGEHAND_MODEL_API_KEY` | Stagehand. Authenticates requests to Stagehand. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/developer-tools-and-infra/browserbase/poc/package.json](../../use-cases/developer-tools-and-infra/browserbase/poc/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@ai-sdk/openai` | `4.0.53` |
| `@browserbasehq/sdk` | `2.19.0` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `ai` | `7.0.87` |
| `commander` | `15.0.0` |
| `picocolors` | `1.1.1` |
| `yaml` | `2.9.0` |
| `zod` | `4.5.4` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Legacy Stagehand dependency ^2.4.0; migration needed before claiming current SDK compatibility.
- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/developer-tools-and-infra/browserbase/poc) at commit `0000000000000000000000000000000000000000`.

Related topics: [Browser configuration](../topics/browser-features.md), [Testing and observability](../topics/testing-and-observability.md).
