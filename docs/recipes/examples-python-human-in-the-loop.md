# Human-in-the-loop handoff (Python)

Pause a Browserbase Playwright workflow for explicit operator review before an optional configured action.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/python/human-in-the-loop`.
- Languages: python.
- Frameworks: Playwright, Browserbase SDK.
- [Upstream setup and behavior](../../examples/python/human-in-the-loop/README.md).
- [Dependency manifest `examples/python/human-in-the-loop/pyproject.toml`](../../examples/python/human-in-the-loop/pyproject.toml).
- [Dependency manifest `examples/python/human-in-the-loop/uv.lock`](../../examples/python/human-in-the-loop/uv.lock).
- [Source `examples/python/human-in-the-loop/main.py`](../../examples/python/human-in-the-loop/main.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/python/human-in-the-loop
uv sync
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
uv run python main.py
```

## Environment

[Environment template](../../examples/python/human-in-the-loop/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `TARGET_URL` | Recipe configuration. Selects the authorized HTTPS page to review. Non-secret. | `https://example.com` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `APPROVAL_SELECTOR` | Recipe configuration. Selects the one element allowed after approval. Non-secret. | `button[data-action="continue"]` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [examples/python/human-in-the-loop/pyproject.toml](../../examples/python/human-in-the-loop/pyproject.toml). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `browserbase==1.18.1`
- `playwright==1.62.0`
- `python-dotenv==1.2.2`

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

## Provenance

Cookbook-authored example. Its reviewed source is included at the local paths above.

Related topics: [Getting started](../topics/getting-started.md), [Forms and transactions](../topics/forms-and-transactions.md), [Agents and human handoff](../topics/agents-and-human-handoff.md).
