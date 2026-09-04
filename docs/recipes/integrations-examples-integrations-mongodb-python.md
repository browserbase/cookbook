# MongoDB · Python

Stagehand MongoDB Scraper (Python)

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `integrations/examples/integrations/mongodb/python`.
- Languages: python.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../integrations/examples/integrations/mongodb/python/README.md).
- [Dependency manifest `integrations/examples/integrations/mongodb/python/requirements.txt`](../../integrations/examples/integrations/mongodb/python/requirements.txt).
- [Source `integrations/examples/integrations/mongodb/python/main.py`](../../integrations/examples/integrations/mongodb/python/main.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd integrations/examples/integrations/mongodb/python
pip install -r requirements.txt
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
python main.py
```

## Environment

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `MODEL_API_KEY` | Recipe configuration. Authenticates requests to Recipe configuration. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `DB_NAME` | Recipe configuration. Configures db name behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `MONGO_URI` | Recipe configuration. Configures the mongo uri endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [integrations/examples/integrations/mongodb/python/requirements.txt](../../integrations/examples/integrations/mongodb/python/requirements.txt). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `colorama>=0.4.6`
- `pydantic>=2.0.0`
- `pymongo>=4.6.0`
- `python-dotenv>=1.0.0`
- `rich>=13.0.0`
- `stagehand==4.0.2`

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/integrations/tree/b7bc81c6fd4e089ab0c0df2b82529b200739e458/examples/integrations/mongodb/python) at commit `b7bc81c6fd4e089ab0c0df2b82529b200739e458`.

Related topics: [Integrations and orchestration](../topics/integrations-and-orchestration.md).
