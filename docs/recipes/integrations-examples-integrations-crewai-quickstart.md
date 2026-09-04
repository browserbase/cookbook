# CrewAI · quickstart

Quickstart

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** unknown (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `integrations/examples/integrations/crewai/quickstart`.
- Languages: python.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../integrations/examples/integrations/crewai/quickstart/README.md).
- [Dependency manifest `integrations/examples/integrations/crewai/quickstart/requirements.txt`](../../integrations/examples/integrations/crewai/quickstart/requirements.txt).
- [Source `integrations/examples/integrations/crewai/quickstart/main.py`](../../integrations/examples/integrations/crewai/quickstart/main.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd integrations/examples/integrations/crewai/quickstart
pip install -r requirements.txt
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
python main.py
```

## Environment

No direct environment variable references were extracted. SDK defaults, external configuration, and deployment settings may still require credentials. Read the source before running.

## Dependencies

Declared runtime dependencies from [integrations/examples/integrations/crewai/quickstart/requirements.txt](../../integrations/examples/integrations/crewai/quickstart/requirements.txt). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `browserbase==1.18.1`
- `crewai==1.15.20`
- `playwright==1.62.0`
- `python-dotenv>=1.2.2,<2`

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/integrations/tree/b7bc81c6fd4e089ab0c0df2b82529b200739e458/examples/integrations/crewai/quickstart) at commit `b7bc81c6fd4e089ab0c0df2b82529b200739e458`.

Related topics: [Getting started](../topics/getting-started.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md).
