# Cartesia form filling (Python)

Voice agent that conducts phone questionnaires while automatically filling out web forms

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/python/cartesia-form-filling`.
- Languages: python.
- Frameworks: Stagehand, Browserbase SDK.
- [Upstream setup and behavior](../../examples/python/cartesia-form-filling/README.md).
- [Dependency manifest `examples/python/cartesia-form-filling/pyproject.toml`](../../examples/python/cartesia-form-filling/pyproject.toml).
- [Source `examples/python/cartesia-form-filling/main.py`](../../examples/python/cartesia-form-filling/main.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/python/cartesia-form-filling
uv sync
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
uv run python main.py
```

## Environment

[Environment template](../../examples/python/cartesia-form-filling/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | [Google AI](https://aistudio.google.com/apikey). Authenticates requests to Google AI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `MODEL_ID` | Recipe configuration. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [examples/python/cartesia-form-filling/pyproject.toml](../../examples/python/cartesia-form-filling/pyproject.toml). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `PyYAML>=6.0.0`
- `aiohttp>=3.12.0`
- `cartesia-line==0.1.12`
- `fastapi==0.115.14`
- `google-genai>=1.26.0`
- `loguru>=0.7.0`
- `pydantic>=2.0.0`
- `python-dotenv>=1.0.0`
- `stagehand==4.0.2`

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Upstream README references missing requirements.txt; use pyproject.toml with uv.
- Voice-agent app requires Cartesia Line and Gemini credentials, a phone-call environment, and submits a form when the call ends.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/python/cartesia-form-filling) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Forms and transactions](../topics/forms-and-transactions.md), [Agents and human handoff](../topics/agents-and-human-handoff.md).
