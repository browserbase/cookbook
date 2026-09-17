# Flight booking

Reference workflow for flight booking; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** legacy · source inspected.

**Recipe type:** reference.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/travel-and-hospitality/flight-booking`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/travel-and-hospitality/flight-booking/README.md).
- [Dependency manifest `use-cases/travel-and-hospitality/flight-booking/package.json`](../../use-cases/travel-and-hospitality/flight-booking/package.json).
- [Source `use-cases/travel-and-hospitality/flight-booking/src/main.ts`](../../use-cases/travel-and-hospitality/flight-booking/src/main.ts).
- [Source `use-cases/travel-and-hospitality/flight-booking/src/test-connection.ts`](../../use-cases/travel-and-hospitality/flight-booking/src/test-connection.ts).
- Original use-case taxonomy: travel-and-hospitality.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/travel-and-hospitality/flight-booking
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/travel-and-hospitality/flight-booking/.env.example) lists example configuration. Fill in your own values locally.

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
| `DEBUG` | Recipe configuration. Configures debug behavior for this recipe. Non-secret. | `false` | Use the format described by the recipe. No default. |
| `DEPARTURE_DATE` | Recipe configuration. Configures departure date behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `DESTINATION_AIRPORT` | Recipe configuration. Configures destination airport behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `ORIGIN_AIRPORT` | Recipe configuration. Configures origin airport behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `PASSENGERS` | Recipe configuration. Configures passengers behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `RETURN_DATE` | Recipe configuration. Configures return date behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TRIP_TYPE` | Recipe configuration. Configures trip type behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/travel-and-hospitality/flight-booking/package.json](../../use-cases/travel-and-hospitality/flight-booking/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@ai-sdk/openai` | `4.0.59` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `ai` | `7.0.93` |
| `dotenv` | `17.4.2` |
| `tsx` | `4.23.13` |
| `typescript` | `7.0.2` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Legacy Stagehand dependency ^2.4.2; migration needed before claiming current SDK compatibility.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Extraction and research](../topics/extraction-and-research.md), [Forms and transactions](../topics/forms-and-transactions.md), [Commerce and travel](../topics/commerce-and-travel.md).
