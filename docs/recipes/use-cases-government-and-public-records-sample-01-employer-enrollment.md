# Employer Enrollment

Private source-inspected example for employer enrollment.

**Status:** current · private · source inspected.

**Recipe type:** reusable snippet.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/government-and-public-records/sample-01/employer-enrollment`.
- Languages: typescript.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../use-cases/government-and-public-records/sample-01/employer-enrollment/README.md).
- [Dependency manifest `use-cases/government-and-public-records/sample-01/employer-enrollment/package.json`](../../use-cases/government-and-public-records/sample-01/employer-enrollment/package.json).
- [Source `use-cases/government-and-public-records/sample-01/employer-enrollment/src/orchestrator.ts`](../../use-cases/government-and-public-records/sample-01/employer-enrollment/src/orchestrator.ts).
- Original use-case taxonomy: government-and-public-records.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/government-and-public-records/sample-01/employer-enrollment
npm install
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/government-and-public-records/sample-01/employer-enrollment/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `AGENTMAIL_API_KEY` | Recipe configuration. Authenticates requests to Recipe configuration. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `CA_EDD_ALLOW_ACCOUNT_CREATION` | Recipe configuration. Configures ca edd allow account creation behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `DUMP_FORM` | Recipe configuration. Configures dump form behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `SMOKE` | Recipe configuration. Configures smoke behavior for this recipe. Non-secret. | `false` | Use the format described by the recipe. No default. |
| `TEST_ADDRESS_LINE1` | Recipe configuration. Configures test address line1 behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TEST_BUSINESS_NAME` | Recipe configuration. Configures test business name behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TEST_CITY` | Recipe configuration. Configures test city behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TEST_EIN` | Recipe configuration. Configures test ein behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TEST_FIRST_NAME` | Recipe configuration. Configures test first name behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TEST_LAST_NAME` | Recipe configuration. Configures test last name behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TEST_PHONE` | Recipe configuration. Configures test phone behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TEST_STATE` | Recipe configuration. Configures test state behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TEST_ZIP` | Recipe configuration. Configures test zip behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/government-and-public-records/sample-01/employer-enrollment/package.json](../../use-cases/government-and-public-records/sample-01/employer-enrollment/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `agentmail` | `0.5.21` |
| `dotenv` | `17.4.2` |
| `playwright` | `1.62.1` |
| `zod` | `4.5.4` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/government-and-public-records/sample-01/employer-enrollment) at commit `0000000000000000000000000000000000000000`.

Related topics: [Forms and transactions](../topics/forms-and-transactions.md), [Agents and human handoff](../topics/agents-and-human-handoff.md), [Business operations](../topics/business-operations.md).
