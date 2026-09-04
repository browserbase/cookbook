# Hackernews (Go)

Demonstrate Stagehand V4's core browser automation primitives through a complete Hacker News workflow.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/go/hackernews`.
- Languages: go.
- Frameworks: Stagehand, Browserbase SDK.
- [Upstream setup and behavior](../../examples/go/hackernews/README.md).
- [Dependency manifest `examples/go/hackernews/go.mod`](../../examples/go/hackernews/go.mod).
- [Source `examples/go/hackernews/main.go`](../../examples/go/hackernews/main.go).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/go/hackernews
go mod download
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
go run .
```

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [examples/go/hackernews/go.mod](../../examples/go/hackernews/go.mod). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `github.com/browserbase/stagehand/packages/sdk-go/v4` | `v4.0.2` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/go/hackernews) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Getting started](../topics/getting-started.md), [Extraction and research](../topics/extraction-and-research.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md).
