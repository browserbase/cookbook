# MFA handling (Python)

Automate MFA (Multi-Factor Authentication) completion using TOTP (Time-based One-Time Password) code generation.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/python/mfa-handling`.
- Languages: python.
- Frameworks: Stagehand, Browserbase SDK.
- [Upstream setup and behavior](../../examples/python/mfa-handling/README.md).
- [Dependency manifest `examples/python/mfa-handling/pyproject.toml`](../../examples/python/mfa-handling/pyproject.toml).
- [Dependency manifest `examples/python/mfa-handling/requirements.txt`](../../examples/python/mfa-handling/requirements.txt).
- [Source `examples/python/mfa-handling/main.py`](../../examples/python/mfa-handling/main.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/python/mfa-handling
uv sync
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
uv run python main.py
```

## Environment

[Environment template](../../examples/python/mfa-handling/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [examples/python/mfa-handling/pyproject.toml](../../examples/python/mfa-handling/pyproject.toml). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `pydantic>=2.12,<3`
- `python-dotenv==1.2.2`
- `stagehand==4.0.2`

### Additional manifest: `examples/python/mfa-handling/requirements.txt`

[Manifest](../../examples/python/mfa-handling/requirements.txt). Follow the documented setup path; these declarations are not merged with the primary manifest.

- `pydantic>=2.12,<3`
- `python-dotenv==1.2.2`
- `stagehand==4.0.2`

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/python/mfa-handling) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Authentication and saved sessions](../topics/authentication.md).
