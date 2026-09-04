# Opentable Reservations

Private source-inspected example for opentable reservations.

**Status:** current · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/travel-and-hospitality/sample-01/opentable-reservations`.
- Languages: python.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../use-cases/travel-and-hospitality/sample-01/opentable-reservations/README.md).
- [Dependency manifest `use-cases/travel-and-hospitality/sample-01/opentable-reservations/requirements.txt`](../../use-cases/travel-and-hospitality/sample-01/opentable-reservations/requirements.txt).
- [Source `use-cases/travel-and-hospitality/sample-01/opentable-reservations/skill/reference.py`](../../use-cases/travel-and-hospitality/sample-01/opentable-reservations/skill/reference.py).
- Original use-case taxonomy: travel-and-hospitality.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/travel-and-hospitality/sample-01/opentable-reservations
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
python3 skill/reference.py --help
```

## Environment

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_CONTEXT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects a saved browser context for this workflow. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/travel-and-hospitality/sample-01/opentable-reservations/requirements.txt](../../use-cases/travel-and-hospitality/sample-01/opentable-reservations/requirements.txt). Alternate manifests may differ; use the documented setup path.

Consult the linked manifest or upstream instructions. This catalog does not invent missing dependency versions.

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.
- The deterministic Python executor has no third-party Python dependencies. The help command is local. Actual search/book commands invoke the separately installed bb CLI and require Browserbase credentials/context; book can create a real reservation. See GETTING_STARTED.md for the input schema; replace stale example dates before use.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/travel-and-hospitality/sample-01/opentable-reservations) at commit `0000000000000000000000000000000000000000`.

Related topics: [Forms and transactions](../topics/forms-and-transactions.md), [Agents and human handoff](../topics/agents-and-human-handoff.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md), [Commerce and travel](../topics/commerce-and-travel.md).
