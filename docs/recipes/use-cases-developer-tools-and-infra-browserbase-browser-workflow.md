# Browser Workflow

Private source-inspected example for browser workflow.

**Status:** current · private · source inspected.

**Recipe type:** reusable snippet.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/developer-tools-and-infra/browserbase/browser-workflow`.
- Languages: javascript.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../use-cases/developer-tools-and-infra/browserbase/browser-workflow/README.md).
- [Dependency manifest `use-cases/developer-tools-and-infra/browserbase/browser-workflow/package.json`](../../use-cases/developer-tools-and-infra/browserbase/browser-workflow/package.json).
- [Source `use-cases/developer-tools-and-infra/browserbase/browser-workflow/harness.mjs`](../../use-cases/developer-tools-and-infra/browserbase/browser-workflow/harness.mjs).
- Original use-case taxonomy: developer-tools-and-infra.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/developer-tools-and-infra/browserbase/browser-workflow
npm run check
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ANTHROPIC_BASE_URL` | [Anthropic](https://console.anthropic.com/settings/keys). Configures the anthropic base url endpoint. Non-secret. | `https://example.invalid` | Use the format described by the recipe. No default. |
| `BAC_AGENT_ID` | Recipe configuration. Configures bac agent id behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BAC_AGENT_NAME` | Recipe configuration. Configures bac agent name behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BAC_CONCURRENCY` | Recipe configuration. Configures bac concurrency behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `BAC_ENV_NAME` | Recipe configuration. Configures bac env name behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `BAC_MODEL` | Recipe configuration. Selects the model used by the recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `MERCHANTS` | Recipe configuration. Configures merchants behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `QUERY` | Recipe configuration. Configures query behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `ZIP` | Recipe configuration. Configures zip behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/developer-tools-and-infra/browserbase/browser-workflow/package.json](../../use-cases/developer-tools-and-infra/browserbase/browser-workflow/package.json). Alternate manifests may differ; use the documented setup path.

Consult the linked manifest or upstream instructions. This catalog does not invent missing dependency versions.

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.
- Uses Node.js built-ins and fetch; no npm dependency installation is required. npm run check performs syntax checks only and does not start services or execute workflows.
- harness.mjs exports orchestration helpers, not a standalone workflow. Import it from your workflow module as described in README.md, then run that module with node. Agent calls can create remote agents/environments; importing or running arbitrary workflow code is not a syntax check.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/developer-tools-and-infra/browserbase/browser-workflow) at commit `0000000000000000000000000000000000000000`.

Related topics: [Agents and human handoff](../topics/agents-and-human-handoff.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md).
