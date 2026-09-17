# Workflow recorder

Reference workflow for workflow recorder; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** reference.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/developer-tools-and-infra/workflow-recorder`.
- Languages: javascript.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../use-cases/developer-tools-and-infra/workflow-recorder/README.md).
- [Dependency manifest `use-cases/developer-tools-and-infra/workflow-recorder/package.json`](../../use-cases/developer-tools-and-infra/workflow-recorder/package.json).
- [Source `use-cases/developer-tools-and-infra/workflow-recorder/scripts/cli.mjs`](../../use-cases/developer-tools-and-infra/workflow-recorder/scripts/cli.mjs).
- [Source `use-cases/developer-tools-and-infra/workflow-recorder/scripts/cdp.mjs`](../../use-cases/developer-tools-and-infra/workflow-recorder/scripts/cdp.mjs).
- [Source `use-cases/developer-tools-and-infra/workflow-recorder/scripts/detect-parameters.mjs`](../../use-cases/developer-tools-and-infra/workflow-recorder/scripts/detect-parameters.mjs).
- [Source `use-cases/developer-tools-and-infra/workflow-recorder/scripts/emit-script.mjs`](../../use-cases/developer-tools-and-infra/workflow-recorder/scripts/emit-script.mjs).
- [Source `use-cases/developer-tools-and-infra/workflow-recorder/scripts/record-bb.mjs`](../../use-cases/developer-tools-and-infra/workflow-recorder/scripts/record-bb.mjs).
- [Source `use-cases/developer-tools-and-infra/workflow-recorder/scripts/transform-recording.mjs`](../../use-cases/developer-tools-and-infra/workflow-recorder/scripts/transform-recording.mjs).
- [Source `use-cases/developer-tools-and-infra/workflow-recorder/scripts/recorder.js`](../../use-cases/developer-tools-and-infra/workflow-recorder/scripts/recorder.js).
- Original use-case taxonomy: developer-tools-and-infra.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/developer-tools-and-infra/workflow-recorder
npm install
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
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/developer-tools-and-infra/workflow-recorder/package.json](../../use-cases/developer-tools-and-infra/workflow-recorder/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/stagehand` | `4.0.2` |
| `ws` | `8.21.3` |
| `zod` | `4.5.4` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Agents and human handoff](../topics/agents-and-human-handoff.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md).
