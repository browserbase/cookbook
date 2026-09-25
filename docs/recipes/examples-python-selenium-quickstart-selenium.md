# Quickstart Selenium (Python)

Connect to a cloud browser via Selenium and Browserbase, click interactive elements, navigate between pages, and extract page copy.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/python/selenium/quickstart-selenium`.
- Languages: python.
- Frameworks: Selenium, Browserbase SDK.
- [Upstream setup and behavior](../../examples/python/selenium/quickstart-selenium/README.md).
- [Dependency manifest `examples/python/selenium/quickstart-selenium/pyproject.toml`](../../examples/python/selenium/quickstart-selenium/pyproject.toml).
- [Source `examples/python/selenium/quickstart-selenium/main.py`](../../examples/python/selenium/quickstart-selenium/main.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/python/selenium/quickstart-selenium
uv sync
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
uv run python main.py
```

## Environment

[Environment template](../../examples/python/selenium/quickstart-selenium/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [examples/python/selenium/quickstart-selenium/pyproject.toml](../../examples/python/selenium/quickstart-selenium/pyproject.toml). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `browserbase==1.18.1`
- `python-dotenv>=1.2.2`
- `selenium==4.48.0`

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/python/selenium/quickstart-selenium) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Getting started](../topics/getting-started.md), [Extraction and research](../topics/extraction-and-research.md).
