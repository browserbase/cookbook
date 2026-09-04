# Liveview Login Starter

Private source-inspected example for liveview login starter.

**Status:** current · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/data-migration/sample-01/liveview-login-starter`.
- Languages: javascript.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../use-cases/data-migration/sample-01/liveview-login-starter/README.md).
- [Dependency manifest `use-cases/data-migration/sample-01/liveview-login-starter/package.json`](../../use-cases/data-migration/sample-01/liveview-login-starter/package.json).
- [Source `use-cases/data-migration/sample-01/liveview-login-starter/server.js`](../../use-cases/data-migration/sample-01/liveview-login-starter/server.js).
- [Source `use-cases/data-migration/sample-01/liveview-login-starter/lib/browserbase.js`](../../use-cases/data-migration/sample-01/liveview-login-starter/lib/browserbase.js).
- [Source `use-cases/data-migration/sample-01/liveview-login-starter/public/app.js`](../../use-cases/data-migration/sample-01/liveview-login-starter/public/app.js).
- Original use-case taxonomy: data-migration.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/data-migration/sample-01/liveview-login-starter
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run start
```

## Environment

[Environment template](../../use-cases/data-migration/sample-01/liveview-login-starter/.env.example) lists example configuration. Fill in your own values locally.

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

Declared runtime dependencies from [use-cases/data-migration/sample-01/liveview-login-starter/package.json](../../use-cases/data-migration/sample-01/liveview-login-starter/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `dotenv` | `17.4.2` |
| `express` | `5.2.1` |
| `playwright-core` | `1.63.0` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/data-migration/sample-01/liveview-login-starter) at commit `0000000000000000000000000000000000000000`.

Related topics: [Authentication and saved sessions](../topics/authentication.md), [Business operations](../topics/business-operations.md).
