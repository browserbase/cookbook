# Fs Tunnel

Private source-inspected example for fs tunnel.

**Status:** current · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/developer-tools-and-infra/browserbase/fs-tunnel`.
- Languages: javascript.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../use-cases/developer-tools-and-infra/browserbase/fs-tunnel/README.md).
- [Dependency manifest `use-cases/developer-tools-and-infra/browserbase/fs-tunnel/package.json`](../../use-cases/developer-tools-and-infra/browserbase/fs-tunnel/package.json).
- [Source `use-cases/developer-tools-and-infra/browserbase/fs-tunnel/launch-fs.mjs`](../../use-cases/developer-tools-and-infra/browserbase/fs-tunnel/launch-fs.mjs).
- [Source `use-cases/developer-tools-and-infra/browserbase/fs-tunnel/attach.mjs`](../../use-cases/developer-tools-and-infra/browserbase/fs-tunnel/attach.mjs).
- Original use-case taxonomy: developer-tools-and-infra.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/developer-tools-and-infra/browserbase/fs-tunnel
npm install
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run start
```

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/developer-tools-and-infra/browserbase/fs-tunnel/package.json](../../use-cases/developer-tools-and-infra/browserbase/fs-tunnel/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `playwright-core` | `1.62.1` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/developer-tools-and-infra/browserbase/fs-tunnel) at commit `0000000000000000000000000000000000000000`.

Related topics: [Browser configuration](../topics/browser-features.md).
