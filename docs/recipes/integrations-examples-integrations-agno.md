# Agno

Agno + Browserbase Integration

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `integrations/examples/integrations/agno`.
- Languages: python.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../integrations/examples/integrations/agno/README.md).
- [Dependency manifest `integrations/examples/integrations/agno/requirements.txt`](../../integrations/examples/integrations/agno/requirements.txt).
- [Source `integrations/examples/integrations/agno/main.py`](../../integrations/examples/integrations/agno/main.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd integrations/examples/integrations/agno
pip install -r requirements.txt
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
python main.py
```

## Environment

[Environment template](../../integrations/examples/integrations/agno/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [integrations/examples/integrations/agno/requirements.txt](../../integrations/examples/integrations/agno/requirements.txt). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `agno==3.0.6`
- `browserbase==1.18.1`
- `openai>=2,<3`
- `playwright==1.62.0`
- `python-dotenv>=1.2.2,<2`

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/integrations/tree/b7bc81c6fd4e089ab0c0df2b82529b200739e458/examples/integrations/agno) at commit `b7bc81c6fd4e089ab0c0df2b82529b200739e458`.

Related topics: [Integrations and orchestration](../topics/integrations-and-orchestration.md).
