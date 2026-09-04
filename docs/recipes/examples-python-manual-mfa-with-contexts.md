# Manual MFA with contexts (Python)

Demonstrate how to persist authentication across sessions using Browserbase Contexts, eliminating MFA friction after the first login.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/python/manual-mfa-with-contexts`.
- Languages: python.
- Frameworks: Stagehand, Browserbase SDK.
- [Upstream setup and behavior](../../examples/python/manual-mfa-with-contexts/README.md).
- [Dependency manifest `examples/python/manual-mfa-with-contexts/pyproject.toml`](../../examples/python/manual-mfa-with-contexts/pyproject.toml).
- [Dependency manifest `examples/python/manual-mfa-with-contexts/requirements.txt`](../../examples/python/manual-mfa-with-contexts/requirements.txt).
- [Source `examples/python/manual-mfa-with-contexts/main.py`](../../examples/python/manual-mfa-with-contexts/main.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/python/manual-mfa-with-contexts
uv sync
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
uv run python main.py
```

## Environment

[Environment template](../../examples/python/manual-mfa-with-contexts/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `GITHUB_PASSWORD` | Recipe configuration. Provides the github password credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `GITHUB_USERNAME` | Recipe configuration. Provides the github username credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [examples/python/manual-mfa-with-contexts/pyproject.toml](../../examples/python/manual-mfa-with-contexts/pyproject.toml). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `browserbase==1.18.1`
- `pydantic>=2.12,<3`
- `python-dotenv==1.2.2`
- `stagehand==4.0.2`

### Additional manifest: `examples/python/manual-mfa-with-contexts/requirements.txt`

[Manifest](../../examples/python/manual-mfa-with-contexts/requirements.txt). Follow the documented setup path; these declarations are not merged with the primary manifest.

- `browserbase==1.18.1`
- `pydantic>=2.12,<3`
- `python-dotenv==1.2.2`
- `stagehand==4.0.2`

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/python/manual-mfa-with-contexts) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Authentication and saved sessions](../topics/authentication.md).
