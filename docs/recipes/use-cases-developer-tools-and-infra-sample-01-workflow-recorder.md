# Workflow Recorder

Private source-inspected example for workflow recorder.

**Status:** current · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/developer-tools-and-infra/sample-01/workflow-recorder`.
- Languages: javascript.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../use-cases/developer-tools-and-infra/sample-01/workflow-recorder/README.md).
- [Dependency manifest `use-cases/developer-tools-and-infra/sample-01/workflow-recorder/package.json`](../../use-cases/developer-tools-and-infra/sample-01/workflow-recorder/package.json).
- [Source `use-cases/developer-tools-and-infra/sample-01/workflow-recorder/scripts/cli.mjs`](../../use-cases/developer-tools-and-infra/sample-01/workflow-recorder/scripts/cli.mjs).
- [Source `use-cases/developer-tools-and-infra/sample-01/workflow-recorder/scripts/cdp.mjs`](../../use-cases/developer-tools-and-infra/sample-01/workflow-recorder/scripts/cdp.mjs).
- [Source `use-cases/developer-tools-and-infra/sample-01/workflow-recorder/scripts/detect-parameters.mjs`](../../use-cases/developer-tools-and-infra/sample-01/workflow-recorder/scripts/detect-parameters.mjs).
- [Source `use-cases/developer-tools-and-infra/sample-01/workflow-recorder/scripts/emit-script.mjs`](../../use-cases/developer-tools-and-infra/sample-01/workflow-recorder/scripts/emit-script.mjs).
- [Source `use-cases/developer-tools-and-infra/sample-01/workflow-recorder/scripts/record-bb.mjs`](../../use-cases/developer-tools-and-infra/sample-01/workflow-recorder/scripts/record-bb.mjs).
- [Source `use-cases/developer-tools-and-infra/sample-01/workflow-recorder/scripts/transform-recording.mjs`](../../use-cases/developer-tools-and-infra/sample-01/workflow-recorder/scripts/transform-recording.mjs).
- [Source `use-cases/developer-tools-and-infra/sample-01/workflow-recorder/scripts/recorder.js`](../../use-cases/developer-tools-and-infra/sample-01/workflow-recorder/scripts/recorder.js).
- Original use-case taxonomy: developer-tools-and-infra.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/developer-tools-and-infra/sample-01/workflow-recorder
npm install
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run start
```

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

Declared runtime dependencies from [use-cases/developer-tools-and-infra/sample-01/workflow-recorder/package.json](../../use-cases/developer-tools-and-infra/sample-01/workflow-recorder/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/stagehand` | `4.0.2` |
| `ws` | `8.21.3` |
| `zod` | `4.5.4` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/developer-tools-and-infra/sample-01/workflow-recorder) at commit `0000000000000000000000000000000000000000`.

Related topics: [Agents and human handoff](../topics/agents-and-human-handoff.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md).
