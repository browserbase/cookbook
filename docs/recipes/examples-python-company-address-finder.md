# Company address finder (Python)

Discover company legal information and physical addresses from Terms of Service and Privacy Policy pages

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/python/company-address-finder`.
- Languages: python.
- Frameworks: Stagehand, Playwright, Deep Agents, Browserbase SDK.
- [Upstream setup and behavior](../../examples/python/company-address-finder/README.md).
- [Dependency manifest `examples/python/company-address-finder/pyproject.toml`](../../examples/python/company-address-finder/pyproject.toml).
- [Source `examples/python/company-address-finder/main.py`](../../examples/python/company-address-finder/main.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/python/company-address-finder
uv sync
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
uv run python main.py
```

## Environment

[Environment template](../../examples/python/company-address-finder/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `AI_GATEWAY_API_KEY` | Recipe configuration. Authenticates requests to Recipe configuration. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `DEEPAGENTS_MODEL` | Recipe configuration. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `STAGEHAND_RUN_TIMEOUT_MS` | Stagehand. Configures stagehand run timeout ms behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `UVX_COMMAND` | Recipe configuration. Configures uvx command behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [examples/python/company-address-finder/pyproject.toml](../../examples/python/company-address-finder/pyproject.toml). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `deepagents==0.7.5`
- `langchain-mcp-adapters==0.3.2`
- `langchain-openai==1.4.3`
- `pydantic>=2.12,<3`
- `python-dotenv==1.2.2`

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/python/company-address-finder) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Extraction and research](../topics/extraction-and-research.md), [Forms and transactions](../topics/forms-and-transactions.md).
