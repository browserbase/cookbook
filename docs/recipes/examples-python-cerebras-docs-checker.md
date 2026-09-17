# Cerebras docs checker (Python)

Crawl any documentation site, discover its source repo, and verify docs accuracy against the actual codebase using Cerebras LLMs.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/python/cerebras-docs-checker`.
- Languages: python.
- Frameworks: Stagehand, Playwright, Deep Agents, Browserbase SDK.
- [Upstream setup and behavior](../../examples/python/cerebras-docs-checker/README.md).
- [Dependency manifest `examples/python/cerebras-docs-checker/pyproject.toml`](../../examples/python/cerebras-docs-checker/pyproject.toml).
- [Source `examples/python/cerebras-docs-checker/main.py`](../../examples/python/cerebras-docs-checker/main.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/python/cerebras-docs-checker
uv sync
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
uv run python main.py
```

## Environment

[Environment template](../../examples/python/cerebras-docs-checker/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `CEREBRAS_API_KEY` | [Cerebras](https://cloud.cerebras.ai/). Authenticates requests to Cerebras. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `CEREBRAS_MODEL` | [Cerebras](https://cloud.cerebras.ai/). Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `MAX_CRAWL_WORKERS` | Recipe configuration. Configures max crawl workers behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `MAX_DEPTH` | Recipe configuration. Configures max depth behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `MAX_PAGES` | Recipe configuration. Configures max pages behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `UVX_COMMAND` | Recipe configuration. Configures uvx command behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [examples/python/cerebras-docs-checker/pyproject.toml](../../examples/python/cerebras-docs-checker/pyproject.toml). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `browserbase==1.18.1`
- `deepagents==0.7.5`
- `httpx`
- `langchain-mcp-adapters==0.3.2`
- `langchain-openai==1.4.3`
- `openai`
- `playwright==1.62.0`
- `pydantic`
- `python-dotenv`

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/python/cerebras-docs-checker) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Testing and observability](../topics/testing-and-observability.md).
