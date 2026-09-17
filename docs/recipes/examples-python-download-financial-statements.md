# Download financial statements (Python)

Automate downloading Apple's quarterly financial statements (PDFs) from their investor relations site.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/python/download-financial-statements`.
- Languages: python.
- Frameworks: Stagehand, Browserbase SDK.
- [Upstream setup and behavior](../../examples/python/download-financial-statements/README.md).
- [Dependency manifest `examples/python/download-financial-statements/pyproject.toml`](../../examples/python/download-financial-statements/pyproject.toml).
- [Source `examples/python/download-financial-statements/main.py`](../../examples/python/download-financial-statements/main.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/python/download-financial-statements
uv sync
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
uv run python main.py
```

## Environment

[Environment template](../../examples/python/download-financial-statements/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [examples/python/download-financial-statements/pyproject.toml](../../examples/python/download-financial-statements/pyproject.toml). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `browserbase==1.18.1`
- `httpx==0.28.1`
- `python-dotenv==1.2.2`
- `stagehand==4.0.2`

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/python/download-financial-statements) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Files and documents](../topics/downloads-and-documents.md).
