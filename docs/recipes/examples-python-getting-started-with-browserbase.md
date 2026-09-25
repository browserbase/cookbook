# Getting started with Browserbase (Python)

Create a Browserbase session, connect with raw Playwright over CDP, and print its session replay URL; Search and Fetch modes are also available.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · clean install verified.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/python/getting-started-with-browserbase`.
- Languages: python.
- Frameworks: Playwright, Browserbase SDK.
- [Upstream setup and behavior](../../examples/python/getting-started-with-browserbase/README.md).
- [Dependency manifest `examples/python/getting-started-with-browserbase/pyproject.toml`](../../examples/python/getting-started-with-browserbase/pyproject.toml).
- [Source `examples/python/getting-started-with-browserbase/main.py`](../../examples/python/getting-started-with-browserbase/main.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/python/getting-started-with-browserbase
uv sync
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
uv run python main.py browser
```

## Environment

[Environment template](../../examples/python/getting-started-with-browserbase/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [examples/python/getting-started-with-browserbase/pyproject.toml](../../examples/python/getting-started-with-browserbase/pyproject.toml). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `browserbase==1.18.1`
- `playwright==1.62.0`
- `python-dotenv`

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

| Check | Date | Runtime | Command | Result and limits |
| --- | --- | --- | --- | --- |
| Clean install verified | 2026-09-05 | `Python 3.13.2; browserbase 1.18.1; playwright 1.62.0` | `uv sync` | passed. Isolated dependency resolution and imports only; no Browserbase session or external request was run. |

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/python/getting-started-with-browserbase) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Getting started](../topics/getting-started.md), [Extraction and research](../topics/extraction-and-research.md).
