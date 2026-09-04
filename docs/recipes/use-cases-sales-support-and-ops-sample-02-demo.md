# Demo

Private source-inspected example for demo.

**Status:** legacy · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/sales-support-and-ops/sample-02/demo`.
- Languages: javascript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/sales-support-and-ops/sample-02/demo/README.md).
- [Dependency manifest `use-cases/sales-support-and-ops/sample-02/demo/package.json`](../../use-cases/sales-support-and-ops/sample-02/demo/package.json).
- [Source `use-cases/sales-support-and-ops/sample-02/demo/mortgage-rates.js`](../../use-cases/sales-support-and-ops/sample-02/demo/mortgage-rates.js).
- Original use-case taxonomy: sales-support-and-ops.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/sales-support-and-ops/sample-02/demo
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run start
```

## Environment

[Environment template](../../use-cases/sales-support-and-ops/sample-02/demo/.env.example) lists example configuration. Fill in your own values locally.

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/sales-support-and-ops/sample-02/demo/package.json](../../use-cases/sales-support-and-ops/sample-02/demo/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/stagehand` | `4.0.2` |
| `zod` | `4.5.4` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Legacy Stagehand dependency ^2.0.0; migration needed before claiming current SDK compatibility.
- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/sales-support-and-ops/sample-02/demo) at commit `0000000000000000000000000000000000000000`.

Related topics: [Business operations](../topics/business-operations.md).
