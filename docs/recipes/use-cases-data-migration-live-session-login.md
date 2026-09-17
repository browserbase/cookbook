# Live session login

Reference workflow for live session login; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** reference.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/data-migration/live-session-login`.
- Languages: javascript.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../use-cases/data-migration/live-session-login/README.md).
- [Dependency manifest `use-cases/data-migration/live-session-login/package.json`](../../use-cases/data-migration/live-session-login/package.json).
- [Source `use-cases/data-migration/live-session-login/server.js`](../../use-cases/data-migration/live-session-login/server.js).
- [Source `use-cases/data-migration/live-session-login/lib/browserbase.js`](../../use-cases/data-migration/live-session-login/lib/browserbase.js).
- [Source `use-cases/data-migration/live-session-login/public/app.js`](../../use-cases/data-migration/live-session-login/public/app.js).
- Original use-case taxonomy: data-migration.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/data-migration/live-session-login
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/data-migration/live-session-login/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `NO_OPEN` | Recipe configuration. Configures no open behavior for this recipe. Non-secret. | `false` | Use the format described by the recipe. No default. |
| `PORT` | Recipe configuration. Configures port behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `START_URL` | Recipe configuration. Configures the start url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/data-migration/live-session-login/package.json](../../use-cases/data-migration/live-session-login/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `dotenv` | `17.4.2` |
| `express` | `5.2.1` |
| `playwright-core` | `1.63.0` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Authentication and saved sessions](../topics/authentication.md), [Business operations](../topics/business-operations.md).
