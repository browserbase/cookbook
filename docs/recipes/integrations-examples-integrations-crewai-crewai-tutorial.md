# CrewAI · CrewAI tutorial

Tutorial: build a Flight Booking Crew

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `integrations/examples/integrations/crewai/crewai-tutorial`.
- Languages: python.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../integrations/examples/integrations/crewai/crewai-tutorial/README.md).
- [Dependency manifest `integrations/examples/integrations/crewai/crewai-tutorial/pyproject.toml`](../../integrations/examples/integrations/crewai/crewai-tutorial/pyproject.toml).
- [Source `integrations/examples/integrations/crewai/crewai-tutorial/main.py`](../../integrations/examples/integrations/crewai/crewai-tutorial/main.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd integrations/examples/integrations/crewai/crewai-tutorial
poetry install
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
poetry run python main.py "Find roundtrip flights from San Francisco to New York for November 5 to November 10"
```

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [integrations/examples/integrations/crewai/crewai-tutorial/pyproject.toml](../../integrations/examples/integrations/crewai/crewai-tutorial/pyproject.toml). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `crewai` | `1.15.20` |
| `html2text` | `>=2024.2.26` |
| `playwright` | `1.62.0` |
| `python-dotenv` | `>=1.2.2,<2` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- The entrypoint requires a quoted task argument. Update the dates before running; historical example outputs are not current prices.
- Use Python 3.12 or 3.13 with Poetry. package-mode=false installs dependencies only; local pip package installation is unsupported.

## Provenance

[Pinned upstream source](https://github.com/browserbase/integrations/tree/b7bc81c6fd4e089ab0c0df2b82529b200739e458/examples/integrations/crewai/crewai-tutorial) at commit `b7bc81c6fd4e089ab0c0df2b82529b200739e458`.

Related topics: [Forms and transactions](../topics/forms-and-transactions.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md), [Commerce and travel](../topics/commerce-and-travel.md).
