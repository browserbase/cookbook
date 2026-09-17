# File upload (Python)

Select one reviewed local file in an authorized upload control without submitting the surrounding form.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/python/file-upload`.
- Languages: python.
- Frameworks: Playwright, Browserbase SDK.
- [Upstream setup and behavior](../../examples/python/file-upload/README.md).
- [Dependency manifest `examples/python/file-upload/pyproject.toml`](../../examples/python/file-upload/pyproject.toml).
- [Dependency manifest `examples/python/file-upload/uv.lock`](../../examples/python/file-upload/uv.lock).
- [Source `examples/python/file-upload/main.py`](../../examples/python/file-upload/main.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/python/file-upload
uv sync
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
uv run python main.py
```

## Environment

[Environment template](../../examples/python/file-upload/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `UPLOAD_TARGET_URL` | Recipe configuration. Selects the authorized HTTPS upload page. Non-secret. | `https://example.com/upload` | Must be non-empty when used. No default. |
| `UPLOAD_SELECTOR` | Recipe configuration. Selects the file input. Non-secret. | `input[type="file"]` | Must be non-empty when used. No default. |
| `UPLOAD_FILE` | Local filesystem. Selects the reviewed local file. Non-secret. | `/absolute/path/to/file.pdf` | Must be non-empty when used. No default. |
| `ALLOW_UPLOAD` | Safety control. Requires explicit upload authorization. Non-secret. | `false` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [examples/python/file-upload/pyproject.toml](../../examples/python/file-upload/pyproject.toml). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `browserbase==1.18.1`
- `playwright==1.62.0`
- `python-dotenv==1.2.2`

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Provenance

Cookbook-authored example. Its reviewed source is included at the local paths above.

Related topics: [Files and documents](../topics/downloads-and-documents.md), [Forms and transactions](../topics/forms-and-transactions.md).
