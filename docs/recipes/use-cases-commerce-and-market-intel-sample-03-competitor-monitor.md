# Competitor Monitor

Private source-inspected example for competitor monitor.

**Status:** current · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/commerce-and-market-intel/sample-03/competitor-monitor`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/commerce-and-market-intel/sample-03/competitor-monitor/README.md).
- [Dependency manifest `use-cases/commerce-and-market-intel/sample-03/competitor-monitor/package.json`](../../use-cases/commerce-and-market-intel/sample-03/competitor-monitor/package.json).
- [Source `use-cases/commerce-and-market-intel/sample-03/competitor-monitor/src/capture/index.ts`](../../use-cases/commerce-and-market-intel/sample-03/competitor-monitor/src/capture/index.ts).
- [Source `use-cases/commerce-and-market-intel/sample-03/competitor-monitor/src/stagedRun.ts`](../../use-cases/commerce-and-market-intel/sample-03/competitor-monitor/src/stagedRun.ts).
- [Source `use-cases/commerce-and-market-intel/sample-03/competitor-monitor/src/fetchPdp.ts`](../../use-cases/commerce-and-market-intel/sample-03/competitor-monitor/src/fetchPdp.ts).
- [Source `use-cases/commerce-and-market-intel/sample-03/competitor-monitor/src/context/bootstrap.ts`](../../use-cases/commerce-and-market-intel/sample-03/competitor-monitor/src/context/bootstrap.ts).
- [Source `use-cases/commerce-and-market-intel/sample-03/competitor-monitor/src/deepDive.ts`](../../use-cases/commerce-and-market-intel/sample-03/competitor-monitor/src/deepDive.ts).
- [Source `use-cases/commerce-and-market-intel/sample-03/competitor-monitor/src/gallery.ts`](../../use-cases/commerce-and-market-intel/sample-03/competitor-monitor/src/gallery.ts).
- Original use-case taxonomy: commerce-and-market-intel.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/commerce-and-market-intel/sample-03/competitor-monitor
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run start
```

## Environment

[Environment template](../../use-cases/commerce-and-market-intel/sample-03/competitor-monitor/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ATTEMPT_BUDGET_MS` | Recipe configuration. Configures attempt budget ms behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BB_CONCURRENCY` | [Browserbase](https://www.browserbase.com/settings). Configures bb concurrency behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `BB_REGION` | [Browserbase](https://www.browserbase.com/settings). Configures bb region behavior for this recipe. Non-secret. | `us-west-2` | Use the format described by the recipe. No default. |
| `MAX_RETRIES` | Recipe configuration. Configures max retries behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `SESSION_TIMEOUT_SEC` | Recipe configuration. Configures session timeout sec behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `STAGEHAND_MODEL` | Stagehand. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `SUCCESS_THRESHOLD` | Recipe configuration. Configures success threshold behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `WORKERS` | Recipe configuration. Configures workers behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/commerce-and-market-intel/sample-03/competitor-monitor/package.json](../../use-cases/commerce-and-market-intel/sample-03/competitor-monitor/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `dotenv` | `17.4.2` |
| `p-limit` | `7.3.2` |
| `playwright-core` | `1.63.0` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/commerce-and-market-intel/sample-03/competitor-monitor) at commit `0000000000000000000000000000000000000000`.

Related topics: [Commerce and travel](../topics/commerce-and-travel.md).
