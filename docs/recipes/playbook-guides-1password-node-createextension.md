# Create extension (TypeScript, Browserbase)

Demonstrate create extension with Browserbase SDK.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `playbook/guides/1password/node`.
- Languages: typescript.
- Frameworks: Browserbase SDK.
- [Upstream setup and behavior](../../playbook/UPSTREAM_README.md).
- [Dependency manifest `playbook/guides/1password/node/package.json`](../../playbook/guides/1password/node/package.json).
- [Source `playbook/guides/1password/node/createExtension.ts`](../../playbook/guides/1password/node/createExtension.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd playbook/guides/1password/node
npm install
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npx --no-install tsx createExtension.ts
```

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `EXTENSION_ZIP_PATH` | Recipe configuration. Configures extension zip path behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [playbook/guides/1password/node/package.json](../../playbook/guides/1password/node/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `dotenv` | `16.6.1` |
| `playwright-core` | `1.63.0` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Browserbase Playbook snapshot; inspect hardcoded URLs, credentials, IDs, and site-specific assumptions before use.
- 1Password extension guide requires external account and unpacked extension setup.
- The recorded shared manifest includes the migrated SDK dependencies. live extension login remains unverified.
- Extension upload requires EXTENSION_ZIP_PATH and creates a remote extension. Login scripts require EXTENSION_ID for an uploaded extension and account setup. Run upload and login as separate steps; cookbook verification does not perform either operation.

## Provenance

[Pinned upstream source](https://github.com/browserbase/playbook/tree/001362e91bf6af47c03f16258cb1126e2043bff1/guides/1password/node/createExtension.ts) at commit `001362e91bf6af47c03f16258cb1126e2043bff1`.

Related topics: [Authentication and saved sessions](../topics/authentication.md), [Browser configuration](../topics/browser-features.md).
