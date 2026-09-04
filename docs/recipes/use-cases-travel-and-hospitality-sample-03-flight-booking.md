# Flight Booking

Private source-inspected example for flight booking.

**Status:** legacy · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/travel-and-hospitality/sample-03/flight-booking`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/travel-and-hospitality/sample-03/flight-booking/README.md).
- [Dependency manifest `use-cases/travel-and-hospitality/sample-03/flight-booking/package.json`](../../use-cases/travel-and-hospitality/sample-03/flight-booking/package.json).
- [Source `use-cases/travel-and-hospitality/sample-03/flight-booking/src/main.ts`](../../use-cases/travel-and-hospitality/sample-03/flight-booking/src/main.ts).
- [Source `use-cases/travel-and-hospitality/sample-03/flight-booking/src/test-connection.ts`](../../use-cases/travel-and-hospitality/sample-03/flight-booking/src/test-connection.ts).
- Original use-case taxonomy: travel-and-hospitality.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/travel-and-hospitality/sample-03/flight-booking
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run dev
npm run start
```

## Environment

[Environment template](../../use-cases/travel-and-hospitality/sample-03/flight-booking/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

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

Declared runtime dependencies from [use-cases/travel-and-hospitality/sample-03/flight-booking/package.json](../../use-cases/travel-and-hospitality/sample-03/flight-booking/package.json). Alternate manifests may differ; use the documented setup path.

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

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Legacy Stagehand dependency ^2.4.2; migration needed before claiming current SDK compatibility.
- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/travel-and-hospitality/sample-03/flight-booking) at commit `0000000000000000000000000000000000000000`.

Related topics: [Extraction and research](../topics/extraction-and-research.md), [Forms and transactions](../topics/forms-and-transactions.md), [Commerce and travel](../topics/commerce-and-travel.md).
