# Website link tester (Python)

Crawl a website’s homepage, collect all links, and verify that each link loads successfully and matches its link text.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/python/website-link-tester`.
- Languages: python.
- Frameworks: Stagehand, Browserbase SDK.
- [Upstream setup and behavior](../../examples/python/website-link-tester/README.md).
- [Dependency manifest `examples/python/website-link-tester/pyproject.toml`](../../examples/python/website-link-tester/pyproject.toml).
- [Source `examples/python/website-link-tester/main.py`](../../examples/python/website-link-tester/main.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/python/website-link-tester
uv sync
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
uv run python main.py
```

## Environment

[Environment template](../../examples/python/website-link-tester/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `MAX_LINKS` | Recipe configuration. Configures max links behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [examples/python/website-link-tester/pyproject.toml](../../examples/python/website-link-tester/pyproject.toml). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `pydantic>=2.12,<3`
- `python-dotenv==1.2.2`
- `stagehand==4.0.2`

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/python/website-link-tester) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Testing and observability](../topics/testing-and-observability.md).
