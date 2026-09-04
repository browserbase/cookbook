# Quickstart Playwright (Python)

Connect to a cloud browser via Playwright and Browserbase, navigate a real website (SFMOMA), interact with UI elements, and extract page content.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/python/playwright/quickstart-playwright`.
- Languages: python.
- Frameworks: Playwright, Browserbase SDK.
- [Upstream setup and behavior](../../examples/python/playwright/quickstart-playwright/README.md).
- [Dependency manifest `examples/python/playwright/quickstart-playwright/pyproject.toml`](../../examples/python/playwright/quickstart-playwright/pyproject.toml).
- [Source `examples/python/playwright/quickstart-playwright/main.py`](../../examples/python/playwright/quickstart-playwright/main.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/python/playwright/quickstart-playwright
uv sync
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
uv run python main.py
```

## Environment

[Environment template](../../examples/python/playwright/quickstart-playwright/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [examples/python/playwright/quickstart-playwright/pyproject.toml](../../examples/python/playwright/quickstart-playwright/pyproject.toml). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `browserbase==1.18.1`
- `playwright==1.62.0`
- `python-dotenv`

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/python/playwright/quickstart-playwright) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Getting started](../topics/getting-started.md), [Extraction and research](../topics/extraction-and-research.md).
