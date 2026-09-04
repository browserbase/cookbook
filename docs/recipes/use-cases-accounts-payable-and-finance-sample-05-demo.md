# Demo

Private source-inspected example for demo.

**Status:** current · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/accounts-payable-and-finance/sample-05/demo`.
- Languages: python.
- Frameworks: stagehand.
- [Upstream setup and behavior](../../use-cases/accounts-payable-and-finance/sample-05/demo/README.md).
- [Dependency manifest `use-cases/accounts-payable-and-finance/sample-05/demo/requirements.txt`](../../use-cases/accounts-payable-and-finance/sample-05/demo/requirements.txt).
- [Source `use-cases/accounts-payable-and-finance/sample-05/demo/delta.py`](../../use-cases/accounts-payable-and-finance/sample-05/demo/delta.py).
- [Source `use-cases/accounts-payable-and-finance/sample-05/demo/delta_cache.py`](../../use-cases/accounts-payable-and-finance/sample-05/demo/delta_cache.py).
- [Source `use-cases/accounts-payable-and-finance/sample-05/demo/delta_with_selectors.py`](../../use-cases/accounts-payable-and-finance/sample-05/demo/delta_with_selectors.py).
- [Source `use-cases/accounts-payable-and-finance/sample-05/demo/prebrowse_python.py`](../../use-cases/accounts-payable-and-finance/sample-05/demo/prebrowse_python.py).
- [Source `use-cases/accounts-payable-and-finance/sample-05/demo/united_receipt.py`](../../use-cases/accounts-payable-and-finance/sample-05/demo/united_receipt.py).
- [Source `use-cases/accounts-payable-and-finance/sample-05/demo/united_receipt_prebrowsing.py`](../../use-cases/accounts-payable-and-finance/sample-05/demo/united_receipt_prebrowsing.py).
- Original use-case taxonomy: accounts-payable-and-finance.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/accounts-payable-and-finance/sample-05/demo
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
python delta.py
```

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `MODEL_API_KEY` | Recipe configuration. Authenticates requests to Recipe configuration. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `PREBROWSE_MINUTES` | Recipe configuration. Configures prebrowse minutes behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `PREBROWSE_TYPE` | Recipe configuration. Configures prebrowse type behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TRAVEL_CARD_LAST_FOUR` | Recipe configuration. Configures travel card last four behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TRAVEL_CONFIRMATION_NUMBER` | Recipe configuration. Configures travel confirmation number behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TRAVEL_END_DATE` | Recipe configuration. Configures travel end date behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TRAVEL_FIRST_NAME` | Recipe configuration. Configures travel first name behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TRAVEL_LAST_NAME` | Recipe configuration. Configures travel last name behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TRAVEL_START_DATE` | Recipe configuration. Configures travel start date behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TRAVEL_TICKET_NUMBER` | Recipe configuration. Configures travel ticket number behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/accounts-payable-and-finance/sample-05/demo/requirements.txt](../../use-cases/accounts-payable-and-finance/sample-05/demo/requirements.txt). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `browserbase==1.18.1`
- `httpx>=0.28,<1`
- `pydantic>=2.13,<3`
- `python-dotenv>=1.2.2,<2`
- `requests>=2.32,<3`
- `rich>=14,<15`
- `stagehand==4.0.2`
- `structlog>=25,<27`

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.
- The launch command runs the Delta receipt variant and requires TRAVEL_FIRST_NAME, TRAVEL_LAST_NAME and TRAVEL_TICKET_NUMBER. Other variants require their own traveler inputs. Live receipt retrieval and cache behavior remain unverified.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/accounts-payable-and-finance/sample-05/demo) at commit `0000000000000000000000000000000000000000`.

Related topics: [Business operations](../topics/business-operations.md).
