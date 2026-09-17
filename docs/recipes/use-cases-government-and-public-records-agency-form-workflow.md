# Agency form workflow

Reference workflow for agency form workflow; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** legacy · source inspected.

**Recipe type:** reference.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/government-and-public-records/agency-form-workflow`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/government-and-public-records/agency-form-workflow/README.md).
- [Dependency manifest `use-cases/government-and-public-records/agency-form-workflow/package.json`](../../use-cases/government-and-public-records/agency-form-workflow/package.json).
- [Source `use-cases/government-and-public-records/agency-form-workflow/src/main.ts`](../../use-cases/government-and-public-records/agency-form-workflow/src/main.ts).
- Original use-case taxonomy: government-and-public-records.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/government-and-public-records/agency-form-workflow
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/government-and-public-records/agency-form-workflow/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
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

Declared runtime dependencies from [use-cases/government-and-public-records/agency-form-workflow/package.json](../../use-cases/government-and-public-records/agency-form-workflow/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `dotenv` | `17.4.2` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Legacy Stagehand dependency ^3.6.0; migration needed before claiming current SDK compatibility.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Business operations](../topics/business-operations.md).
