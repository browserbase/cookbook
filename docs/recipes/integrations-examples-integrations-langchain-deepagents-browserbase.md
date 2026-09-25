# LangChain · deepagents Browserbase

LangChain Deep Agents + Browserbase (Python)

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `integrations/examples/integrations/langchain/deepagents-browserbase`.
- Languages: python.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../integrations/examples/integrations/langchain/deepagents-browserbase/README.md).
- [Dependency manifest `integrations/examples/integrations/langchain/deepagents-browserbase/requirements.txt`](../../integrations/examples/integrations/langchain/deepagents-browserbase/requirements.txt).
- [Source `integrations/examples/integrations/langchain/deepagents-browserbase/main.py`](../../integrations/examples/integrations/langchain/deepagents-browserbase/main.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd integrations/examples/integrations/langchain/deepagents-browserbase
pip install -r requirements.txt
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
python main.py
```

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `DEEPAGENT_BASE_URL` | Recipe configuration. Configures the deepagent base url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |
| `DEEPAGENT_MODEL` | Recipe configuration. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `OPENAI_BASE_URL` | [OpenAI](https://platform.openai.com/api-keys). Configures the openai base url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |
| `STAGEHAND_AGENT_MODEL` | Stagehand. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `STAGEHAND_MODEL` | Stagehand. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [integrations/examples/integrations/langchain/deepagents-browserbase/requirements.txt](../../integrations/examples/integrations/langchain/deepagents-browserbase/requirements.txt). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `beautifulsoup4>=4.13.0`
- `browserbase==1.18.1`
- `deepagents>=0.6.3`
- `langchain-mcp-adapters>=0.2,<1`
- `langchain-openai>=1.2.1`
- `python-dotenv>=1.0.0`
- `stagehand==4.0.2`

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/integrations/tree/b7bc81c6fd4e089ab0c0df2b82529b200739e458/examples/integrations/langchain/deepagents-browserbase) at commit `b7bc81c6fd4e089ab0c0df2b82529b200739e458`.

Related topics: [Agents and human handoff](../topics/agents-and-human-handoff.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md).
