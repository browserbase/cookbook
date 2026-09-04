# Intelligence Demo

Private source-inspected example for intelligence demo.

**Status:** legacy · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/content-and-research/sample-01/intelligence-demo`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../use-cases/content-and-research/sample-01/intelligence-demo/README.md).
- [Dependency manifest `use-cases/content-and-research/sample-01/intelligence-demo/package.json`](../../use-cases/content-and-research/sample-01/intelligence-demo/package.json).
- [Source `use-cases/content-and-research/sample-01/intelligence-demo/src/main.ts`](../../use-cases/content-and-research/sample-01/intelligence-demo/src/main.ts).
- [Source `use-cases/content-and-research/sample-01/intelligence-demo/src/test.ts`](../../use-cases/content-and-research/sample-01/intelligence-demo/src/test.ts).
- Original use-case taxonomy: content-and-research.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/content-and-research/sample-01/intelligence-demo
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run dev
npm run start
```

## Environment

[Environment template](../../use-cases/content-and-research/sample-01/intelligence-demo/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ENABLE_CONTENT_EXTRACTION` | Recipe configuration. Configures enable content extraction behavior for this recipe. Non-secret. | `false` | Use the format described by the recipe. No default. |
| `LOG_LEVEL` | Recipe configuration. Configures log level behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `MAX_POSTS` | Recipe configuration. Configures max posts behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |
| `NODE_ENV` | Recipe configuration. Configures node env behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `TIMEOUT_MS` | Recipe configuration. Configures timeout ms behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/content-and-research/sample-01/intelligence-demo/package.json](../../use-cases/content-and-research/sample-01/intelligence-demo/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/stagehand` | `4.0.2` |
| `chalk` | `6.0.0` |
| `dotenv` | `17.4.2` |
| `ora` | `9.4.1` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Legacy Stagehand dependency ^1.5.0; migration needed before claiming current SDK compatibility.
- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/content-and-research/sample-01/intelligence-demo) at commit `0000000000000000000000000000000000000000`.

Related topics: [Extraction and research](../topics/extraction-and-research.md).
