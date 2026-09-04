# Credential Assisted Login

Private source-inspected example for credential assisted login.

**Status:** current · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/credential-assisted-login`.
- Languages: javascript, python.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../use-cases/credential-assisted-login/README.md).
- [Dependency manifest `use-cases/credential-assisted-login/requirements.txt`](../../use-cases/credential-assisted-login/requirements.txt).
- [Source `use-cases/credential-assisted-login/control.mjs`](../../use-cases/credential-assisted-login/control.mjs).
- [Source `use-cases/credential-assisted-login/demo.py`](../../use-cases/credential-assisted-login/demo.py).
- [Source `use-cases/credential-assisted-login/identity-provider.mjs`](../../use-cases/credential-assisted-login/identity-provider.mjs).
- [Source `use-cases/credential-assisted-login/vault-server.mjs`](../../use-cases/credential-assisted-login/vault-server.mjs).
- Original use-case taxonomy: uncategorized.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/credential-assisted-login
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
python demo.py
```

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `IDP_BASE` | Recipe configuration. Configures idp base behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `IDP_PORT` | Recipe configuration. Configures idp port behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `PORT` | Recipe configuration. Configures port behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `VAULT_PORT` | Recipe configuration. Configures vault port behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `WATCH` | Recipe configuration. Configures watch behavior for this recipe. Non-secret. | `false` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/credential-assisted-login/requirements.txt](../../use-cases/credential-assisted-login/requirements.txt). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `browserbase==1.18.1`
- `httpx>=0.28,<1`
- `playwright==1.62.0`

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.
- This setup covers the Python CLI. Node.js is also required: demo.py starts the identity-provider and vault services, which use Node built-ins. The separate control.mjs visual server requires @browserbasehq/sdk and playwright-core; its JavaScript package boundary is not yet established.
- Export BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID before launch; demo.py does not load a .env file. The CLI uploads an extension and creates a Browserbase session. Authentication and key-handling findings remain open; keep the demonstration access-controlled.
- Use synthetic credentials only. All three servers bind 127.0.0.1, but local callers are unauthenticated and can request a credential encrypted to their own key. The vault decrypts server-side; this is not zero-knowledge or verified browser-session delegation.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/credential-assisted-login) at commit `0000000000000000000000000000000000000000`.

Related topics: [Authentication and saved sessions](../topics/authentication.md), [Agents and human handoff](../topics/agents-and-human-handoff.md).
