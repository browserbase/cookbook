# Cartesia

Voice Agent with Real-time Web Form Filling

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `integrations/examples/integrations/cartesia`.
- Languages: python.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../integrations/examples/integrations/cartesia/README.md).
- [Dependency manifest `integrations/examples/integrations/cartesia/requirements.txt`](../../integrations/examples/integrations/cartesia/requirements.txt).
- [Source `integrations/examples/integrations/cartesia/main.py`](../../integrations/examples/integrations/cartesia/main.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd integrations/examples/integrations/cartesia
pip install -r requirements.txt
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
python main.py
```

## Environment

[Environment template](../../integrations/examples/integrations/cartesia/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | [Google AI](https://aistudio.google.com/apikey). Authenticates requests to Google AI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `MODEL_ID` | Recipe configuration. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [integrations/examples/integrations/cartesia/requirements.txt](../../integrations/examples/integrations/cartesia/requirements.txt). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `PyYAML>=6.0.0`
- `aiohttp>=3.12.0`
- `cartesia-line`
- `google-genai>=1.26.0; python_version>='3.9'`
- `loguru>=0.7.0`
- `pydantic>=2.0.0`
- `python-dotenv>=1.0.0`
- `stagehand==4.0.2`

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/integrations/tree/b7bc81c6fd4e089ab0c0df2b82529b200739e458/examples/integrations/cartesia) at commit `b7bc81c6fd4e089ab0c0df2b82529b200739e458`.

Related topics: [Forms and transactions](../topics/forms-and-transactions.md), [Agents and human handoff](../topics/agents-and-human-handoff.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md).
