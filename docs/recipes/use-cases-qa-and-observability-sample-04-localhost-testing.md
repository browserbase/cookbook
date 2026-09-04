# Localhost Testing

Private source-inspected example for localhost testing.

**Status:** current · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/qa-and-observability/sample-04/localhost-testing`.
- Languages: javascript, shell.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../use-cases/qa-and-observability/sample-04/localhost-testing/README.md).
- [Dependency manifest `use-cases/qa-and-observability/sample-04/localhost-testing/package.json`](../../use-cases/qa-and-observability/sample-04/localhost-testing/package.json).
- [Source `use-cases/qa-and-observability/sample-04/localhost-testing/server.mjs`](../../use-cases/qa-and-observability/sample-04/localhost-testing/server.mjs).
- [Source `use-cases/qa-and-observability/sample-04/localhost-testing/shim.mjs`](../../use-cases/qa-and-observability/sample-04/localhost-testing/shim.mjs).
- Original use-case taxonomy: qa-and-observability.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/qa-and-observability/sample-04/localhost-testing
npm run check
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm start
# In a second terminal in this directory, after setting BB_CONNECT_URL:
npm run shim
```

## Environment

[Environment template](../../use-cases/qa-and-observability/sample-04/localhost-testing/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `MOMENTIC_API_KEY` | target service. Authenticates requests to target service. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BB_CONNECT_URL` | [Browserbase](https://www.browserbase.com/settings). Configures the bb connect url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |
| `SHIM_PORT` | Recipe configuration. Configures shim port behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/qa-and-observability/sample-04/localhost-testing/package.json](../../use-cases/qa-and-observability/sample-04/localhost-testing/package.json). Alternate manifests may differ; use the documented setup path.

Consult the linked manifest or upstream instructions. This catalog does not invent missing dependency versions.

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.
- Uses Node.js built-ins and fetch; no npm dependency installation is required. npm run check performs syntax checks only and does not start services or execute workflows.
- npm start serves the sample app on 127.0.0.1:3000. npm run shim starts the separate proxy on 127.0.0.1:8000 by default; export BB_CONNECT_URL first. Cloud-browser access to localhost still requires the tunnel/setup in the upstream guide.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/qa-and-observability/sample-04/localhost-testing) at commit `0000000000000000000000000000000000000000`.

Related topics: [Testing and observability](../topics/testing-and-observability.md).
