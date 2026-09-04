# Extend Browserbase (Python)

Automate downloading receipts from an expense portal and extract structured receipt data using AI-powered document parsing.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/python/extend-browserbase`.
- Languages: python.
- Frameworks: Stagehand, Browserbase SDK.
- [Upstream setup and behavior](../../examples/python/extend-browserbase/README.md).
- [Dependency manifest `examples/python/extend-browserbase/pyproject.toml`](../../examples/python/extend-browserbase/pyproject.toml).
- [Source `examples/python/extend-browserbase/main.py`](../../examples/python/extend-browserbase/main.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/python/extend-browserbase
uv sync
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
uv run python main.py
```

## Environment

[Environment template](../../examples/python/extend-browserbase/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `EXTEND_API_KEY` | Recipe configuration. Authenticates requests to Recipe configuration. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [examples/python/extend-browserbase/pyproject.toml](../../examples/python/extend-browserbase/pyproject.toml). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `browserbase==1.18.1`
- `extend-ai>=1.0.0`
- `python-dotenv>=1.2.1`
- `stagehand==4.0.2`

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/python/extend-browserbase) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Files and documents](../topics/downloads-and-documents.md), [Extraction and research](../topics/extraction-and-research.md).
