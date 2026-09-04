# Smart fetch scraper (Python)

Scrape a webpage using the fastest method available; Fetch API first, full browser session as fallback.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/python/smart-fetch-scraper`.
- Languages: python.
- Frameworks: Stagehand, Browserbase SDK.
- [Upstream setup and behavior](../../examples/python/smart-fetch-scraper/README.md).
- [Dependency manifest `examples/python/smart-fetch-scraper/pyproject.toml`](../../examples/python/smart-fetch-scraper/pyproject.toml).
- [Source `examples/python/smart-fetch-scraper/main.py`](../../examples/python/smart-fetch-scraper/main.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/python/smart-fetch-scraper
uv sync
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
uv run python main.py https://news.ycombinator.com
```

## Environment

[Environment template](../../examples/python/smart-fetch-scraper/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [examples/python/smart-fetch-scraper/pyproject.toml](../../examples/python/smart-fetch-scraper/pyproject.toml). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `browserbase==1.18.1`
- `pydantic`
- `python-dotenv`
- `stagehand==4.0.2`

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/python/smart-fetch-scraper) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Testing and observability](../topics/testing-and-observability.md).
