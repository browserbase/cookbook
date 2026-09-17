# Box · Stagehand

Browserbase + Box AI Compliance Intake

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `integrations/examples/integrations/box/stagehand`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../integrations/examples/integrations/box/stagehand/README.md).
- [Dependency manifest `integrations/examples/integrations/box/stagehand/package.json`](../../integrations/examples/integrations/box/stagehand/package.json).
- [Source `integrations/examples/integrations/box/stagehand/src/index.ts`](../../integrations/examples/integrations/box/stagehand/src/index.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd integrations/examples/integrations/box/stagehand
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run start
```

## Environment

[Environment template](../../integrations/examples/integrations/box/stagehand/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BOX_CLIENT_SECRET` | [Box](https://developer.box.com/guides/authentication/). Provides the box client secret credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BOX_CLIENT_ID` | [Box](https://developer.box.com/guides/authentication/). Configures box client id behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BOX_ENTERPRISE_ID` | [Box](https://developer.box.com/guides/authentication/). Configures box enterprise id behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BOX_FOLDER_ID` | [Box](https://developer.box.com/guides/authentication/). Configures box folder id behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `LABEL_LINK_TEXT` | Recipe configuration. Configures label link text behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `LABEL_PAGE_URL` | Recipe configuration. Configures the label page url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |
| `SDS_LINK_TEXT` | Recipe configuration. Configures sds link text behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `SDS_PAGE_URL` | Recipe configuration. Configures the sds page url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [integrations/examples/integrations/box/stagehand/package.json](../../integrations/examples/integrations/box/stagehand/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/stagehand` | `4.0.2` |
| `dotenv` | `16.6.1` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Live Browserbase, Box upload, and Box AI validation require provider credentials and remain pending.

## Provenance

[Pinned upstream source](https://github.com/browserbase/integrations/tree/b7bc81c6fd4e089ab0c0df2b82529b200739e458/examples/integrations/box/stagehand) at commit `b7bc81c6fd4e089ab0c0df2b82529b200739e458`.

Related topics: [Files and documents](../topics/downloads-and-documents.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md).
