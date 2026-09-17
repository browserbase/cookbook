# Localhost cloud-browser testing reference

Reference workflow for localhost cloud-browser testing reference; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** reference.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/qa-and-observability/localhost-testing`.
- Languages: javascript, shell.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../use-cases/qa-and-observability/localhost-testing/README.md).
- [Dependency manifest `use-cases/qa-and-observability/localhost-testing/package.json`](../../use-cases/qa-and-observability/localhost-testing/package.json).
- [Source `use-cases/qa-and-observability/localhost-testing/server.mjs`](../../use-cases/qa-and-observability/localhost-testing/server.mjs).
- [Source `use-cases/qa-and-observability/localhost-testing/shim.mjs`](../../use-cases/qa-and-observability/localhost-testing/shim.mjs).
- Original use-case taxonomy: qa-and-observability.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/qa-and-observability/localhost-testing
npm run check
test -f .env || cp .env.example .env
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

[Environment template](../../use-cases/qa-and-observability/localhost-testing/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `TEST_RUNNER_API_KEY` | Operator-supplied test runner. Authenticates an operator-supplied compatible test runner. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BB_CONNECT_URL` | [Browserbase](https://www.browserbase.com/settings). Configures the bb connect url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |
| `SHIM_PORT` | Recipe configuration. Configures shim port behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/qa-and-observability/localhost-testing/package.json](../../use-cases/qa-and-observability/localhost-testing/package.json). Alternate manifests may differ; use the documented setup path.

Consult the linked manifest or upstream instructions. This catalog does not invent missing dependency versions.

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Uses Node.js built-ins and fetch; no npm dependency installation is required. npm run check performs syntax checks only and does not start services or execute workflows.
- npm start serves the sample app on 127.0.0.1:3000. npm run shim starts the separate proxy on 127.0.0.1:8000 by default; export BB_CONNECT_URL first. Cloud-browser access to localhost still requires the tunnel/setup in the upstream guide.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Testing and observability](../topics/testing-and-observability.md).
