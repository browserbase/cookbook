# Browserbase Demo

Private source-inspected example for browserbase demo.

**Status:** legacy · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/government-and-public-records/sample-02/browserbase-demo`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/government-and-public-records/sample-02/browserbase-demo/README.md).
- [Dependency manifest `use-cases/government-and-public-records/sample-02/browserbase-demo/package.json`](../../use-cases/government-and-public-records/sample-02/browserbase-demo/package.json).
- [Source `use-cases/government-and-public-records/sample-02/browserbase-demo/src/main.ts`](../../use-cases/government-and-public-records/sample-02/browserbase-demo/src/main.ts).
- Original use-case taxonomy: government-and-public-records.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/government-and-public-records/sample-02/browserbase-demo
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run start
```

## Environment

[Environment template](../../use-cases/government-and-public-records/sample-02/browserbase-demo/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_ADVANCED_STEALTH` | [Browserbase](https://www.browserbase.com/settings). Configures browserbase advanced stealth behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BROWSERBASE_CAPTCHA_SETTLE_MS` | [Browserbase](https://www.browserbase.com/settings). Configures browserbase captcha settle ms behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BROWSERBASE_DISABLE_STAGEHAND_API` | [Browserbase](https://www.browserbase.com/settings). Configures browserbase disable stagehand api behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BROWSERBASE_OS` | [Browserbase](https://www.browserbase.com/settings). Configures browserbase os behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BROWSERBASE_PROXIES` | [Browserbase](https://www.browserbase.com/settings). Configures browserbase proxies behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BROWSERBASE_PROXY_CITY` | [Browserbase](https://www.browserbase.com/settings). Configures browserbase proxy city behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BROWSERBASE_PROXY_COUNTRY` | [Browserbase](https://www.browserbase.com/settings). Configures browserbase proxy country behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BROWSERBASE_PROXY_STATE` | [Browserbase](https://www.browserbase.com/settings). Configures browserbase proxy state behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BROWSERBASE_SOLVE_CAPTCHAS` | [Browserbase](https://www.browserbase.com/settings). Configures browserbase solve captchas behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BROWSERBASE_VERIFIED` | [Browserbase](https://www.browserbase.com/settings). Configures browserbase verified behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BROWSERBASE_WAIT_FOR_CAPTCHA_SOLVES` | [Browserbase](https://www.browserbase.com/settings). Configures browserbase wait for captcha solves behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `LEE_FIRST_NAME_FALLBACK` | Recipe configuration. Configures lee first name fallback behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `REDACT_OUTPUT` | Recipe configuration. Configures redact output behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `SAVE_SCREENSHOTS` | Recipe configuration. Configures save screenshots behavior for this recipe. Non-secret. | `false` | Use the format described by the recipe. No default. |
| `SEARCH_FIRST_NAME` | Recipe configuration. Configures search first name behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `SEARCH_FROM_DATE` | Recipe configuration. Configures search from date behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `SEARCH_LAST_NAME` | Recipe configuration. Configures search last name behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `SEARCH_LOOKBACK_DAYS` | Recipe configuration. Configures search lookback days behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `SEARCH_TO_DATE` | Recipe configuration. Configures search to date behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `SITE` | Recipe configuration. Configures site behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `USE_BROWSERBASE` | Recipe configuration. Configures use browserbase behavior for this recipe. Non-secret. | `false` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/government-and-public-records/sample-02/browserbase-demo/package.json](../../use-cases/government-and-public-records/sample-02/browserbase-demo/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `dotenv` | `17.4.2` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Legacy Stagehand dependency ^3.6.0; migration needed before claiming current SDK compatibility.
- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/government-and-public-records/sample-02/browserbase-demo) at commit `0000000000000000000000000000000000000000`.

Related topics: [Business operations](../topics/business-operations.md).
