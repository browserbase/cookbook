# Pickleball (Python)

Automate tennis and pickleball court bookings in San Francisco Recreation & Parks system.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/python/pickleball`.
- Languages: python.
- Frameworks: Stagehand, Browserbase SDK.
- [Upstream setup and behavior](../../examples/python/pickleball/README.md).
- [Dependency manifest `examples/python/pickleball/pyproject.toml`](../../examples/python/pickleball/pyproject.toml).
- [Source `examples/python/pickleball/main.py`](../../examples/python/pickleball/main.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/python/pickleball
uv sync
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
uv run python main.py
```

## Environment

[Environment template](../../examples/python/pickleball/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `SF_REC_PARK_EMAIL` | Recipe configuration. Provides the sf rec park email credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `SF_REC_PARK_PASSWORD` | Recipe configuration. Provides the sf rec park password credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ACTIVITY` | Recipe configuration. Configures activity behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BOOK_COURT` | Recipe configuration. Configures book court behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `SELECTED_DATE` | Recipe configuration. Configures selected date behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TIME_OF_DAY` | Recipe configuration. Configures time of day behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [examples/python/pickleball/pyproject.toml](../../examples/python/pickleball/pyproject.toml). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `pydantic>=2.12,<3`
- `python-dotenv==1.2.2`
- `stagehand==4.0.2`

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Upstream README references missing requirements.txt; use pyproject.toml with uv.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/python/pickleball) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Forms and transactions](../topics/forms-and-transactions.md), [Commerce and travel](../topics/commerce-and-travel.md).
