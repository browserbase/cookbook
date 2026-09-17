# Credential Assisted Login

Reference workflow for credential assisted login; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** reference.
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

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

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

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- This setup covers the Python CLI. Node.js is also required: demo.py starts the identity-provider and vault services, which use Node built-ins. The separate control.mjs visual server requires @browserbasehq/sdk and playwright-core; its JavaScript package boundary is not yet established.
- Export BROWSERBASE_API_KEY before launch; demo.py does not load a .env file. The CLI uploads an extension and creates a Browserbase session. Authentication and key-handling findings remain open; review them before use.
- Use synthetic credentials only. All three servers bind 127.0.0.1, but local callers are unauthenticated and can request a credential encrypted to their own key. The vault decrypts server-side; this is not zero-knowledge or verified browser-session delegation.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Authentication and saved sessions](../topics/authentication.md), [Agents and human handoff](../topics/agents-and-human-handoff.md).
