# Provider search with human handoff

Reference workflow for provider search with human handoff; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** legacy · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/healthcare-and-insurance/provider-search-handoff`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/healthcare-and-insurance/provider-search-handoff/README.md).
- [Dependency manifest `use-cases/healthcare-and-insurance/provider-search-handoff/package.json`](../../use-cases/healthcare-and-insurance/provider-search-handoff/package.json).
- [Source `use-cases/healthcare-and-insurance/provider-search-handoff/src/server.ts`](../../use-cases/healthcare-and-insurance/provider-search-handoff/src/server.ts).
- Original use-case taxonomy: healthcare-and-insurance.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/healthcare-and-insurance/provider-search-handoff
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run dev
npm run start
```

## Environment

[Environment template](../../use-cases/healthcare-and-insurance/provider-search-handoff/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | [Google AI](https://aistudio.google.com/apikey). Authenticates requests to Google AI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `GOOGLE_API_KEY` | [Google AI](https://aistudio.google.com/apikey). Authenticates requests to Google AI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `PORT` | Recipe configuration. Configures port behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/healthcare-and-insurance/provider-search-handoff/package.json](../../use-cases/healthcare-and-insurance/provider-search-handoff/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `boxen` | `8.0.1` |
| `chalk` | `6.0.0` |
| `dotenv` | `17.4.2` |
| `express` | `5.2.1` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- This is provider-directory search, not member eligibility or benefits verification. Provider extraction and completed-search status require separate runtime validation.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Agents and human handoff](../topics/agents-and-human-handoff.md), [Extraction and research](../topics/extraction-and-research.md).
