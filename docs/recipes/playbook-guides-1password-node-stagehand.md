# Stagehand (TypeScript, Browserbase)

Demonstrate stagehand with Stagehand/Browserbase SDK.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `playbook/guides/1password/node`.
- Languages: typescript.
- Frameworks: Stagehand, Browserbase SDK.
- [Upstream setup and behavior](../../playbook/UPSTREAM_README.md).
- [Dependency manifest `playbook/guides/1password/node/package.json`](../../playbook/guides/1password/node/package.json).
- [Source `playbook/guides/1password/node/stagehand.ts`](../../playbook/guides/1password/node/stagehand.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd playbook/guides/1password/node
npm install
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npx --no-install tsx stagehand.ts
```

## Environment

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `MODEL_API_KEY` | Recipe configuration. Authenticates requests to Recipe configuration. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `EXTENSION_ID` | Recipe configuration. Configures extension id behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [playbook/guides/1password/node/package.json](../../playbook/guides/1password/node/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `dotenv` | `16.6.1` |
| `playwright-core` | `1.63.0` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Browserbase Playbook snapshot; inspect hardcoded URLs, credentials, IDs, and site-specific assumptions before use.
- 1Password extension guide requires external account and unpacked extension setup.
- The recorded shared manifest includes the migrated SDK dependencies. live extension login remains unverified.
- Extension upload requires EXTENSION_ZIP_PATH and creates a remote extension. Login scripts require EXTENSION_ID for an uploaded extension and account setup. Run upload and login as separate steps; cookbook verification does not perform either operation.

## Provenance

[Pinned upstream source](https://github.com/browserbase/playbook/tree/001362e91bf6af47c03f16258cb1126e2043bff1/guides/1password/node/stagehand.ts) at commit `001362e91bf6af47c03f16258cb1126e2043bff1`.

Related topics: [Authentication and saved sessions](../topics/authentication.md).
