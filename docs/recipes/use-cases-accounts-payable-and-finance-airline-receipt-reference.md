# Airline receipt retrieval

Reference workflow for airline receipt retrieval; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** reference.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/accounts-payable-and-finance/airline-receipt-reference`.
- Languages: python.
- Frameworks: stagehand.
- [Upstream setup and behavior](../../use-cases/accounts-payable-and-finance/airline-receipt-reference/README.md).
- [Dependency manifest `use-cases/accounts-payable-and-finance/airline-receipt-reference/requirements.txt`](../../use-cases/accounts-payable-and-finance/airline-receipt-reference/requirements.txt).
- [Source `use-cases/accounts-payable-and-finance/airline-receipt-reference/airline_a.py`](../../use-cases/accounts-payable-and-finance/airline-receipt-reference/airline_a.py).
- [Source `use-cases/accounts-payable-and-finance/airline-receipt-reference/airline_a_cache.py`](../../use-cases/accounts-payable-and-finance/airline-receipt-reference/airline_a_cache.py).
- [Source `use-cases/accounts-payable-and-finance/airline-receipt-reference/airline_a_with_selectors.py`](../../use-cases/accounts-payable-and-finance/airline-receipt-reference/airline_a_with_selectors.py).
- [Source `use-cases/accounts-payable-and-finance/airline-receipt-reference/prebrowse_python.py`](../../use-cases/accounts-payable-and-finance/airline-receipt-reference/prebrowse_python.py).
- [Source `use-cases/accounts-payable-and-finance/airline-receipt-reference/airline_b_receipt.py`](../../use-cases/accounts-payable-and-finance/airline-receipt-reference/airline_b_receipt.py).
- [Source `use-cases/accounts-payable-and-finance/airline-receipt-reference/airline_b_receipt_prebrowsing.py`](../../use-cases/accounts-payable-and-finance/airline-receipt-reference/airline_b_receipt_prebrowsing.py).
- Original use-case taxonomy: accounts-payable-and-finance.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/accounts-payable-and-finance/airline-receipt-reference
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

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

Declared runtime dependencies from [use-cases/accounts-payable-and-finance/airline-receipt-reference/requirements.txt](../../use-cases/accounts-payable-and-finance/airline-receipt-reference/requirements.txt). Alternate manifests may differ; use the documented setup path.

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

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- The launch command runs the Delta receipt variant and requires TRAVEL_FIRST_NAME, TRAVEL_LAST_NAME and TRAVEL_TICKET_NUMBER. Other variants require their own traveler inputs. Live receipt retrieval and cache behavior remain unverified.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Business operations](../topics/business-operations.md).
