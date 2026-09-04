# Image url download (Python)

Extract all image URLs from a page with Stagehand and download each image with the Browserbase Fetch API.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/python/image-url-download`.
- Languages: python.
- Frameworks: Stagehand, Browserbase SDK.
- [Upstream setup and behavior](../../examples/python/image-url-download/README.md).
- [Dependency manifest `examples/python/image-url-download/pyproject.toml`](../../examples/python/image-url-download/pyproject.toml).
- [Source `examples/python/image-url-download/main.py`](../../examples/python/image-url-download/main.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/python/image-url-download
uv sync
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
uv run python main.py https://www.browserbase.com
```

## Environment

[Environment template](../../examples/python/image-url-download/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `MAX_IMAGES` | Recipe configuration. Configures max images behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [examples/python/image-url-download/pyproject.toml](../../examples/python/image-url-download/pyproject.toml). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `browserbase==1.18.1`
- `playwright==1.62.0`
- `python-dotenv`
- `stagehand==4.0.2`

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/python/image-url-download) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Files and documents](../topics/downloads-and-documents.md), [Extraction and research](../topics/extraction-and-research.md).
