# Demo

Private source-inspected example for demo.

**Status:** current · private · source inspected.

**Recipe type:** reusable snippet.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/sales-support-and-ops/sample-06/demo`.
- Languages: python.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../use-cases/UPSTREAM_README.md).
- [Dependency manifest `use-cases/sales-support-and-ops/sample-06/demo/requirements.txt`](../../use-cases/sales-support-and-ops/sample-06/demo/requirements.txt).
- [Source `use-cases/sales-support-and-ops/sample-06/demo/e2open.py`](../../use-cases/sales-support-and-ops/sample-06/demo/e2open.py).
- Original use-case taxonomy: sales-support-and-ops.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/sales-support-and-ops/sample-06/demo
pip install -r requirements.txt
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/sales-support-and-ops/sample-06/demo/requirements.txt](../../use-cases/sales-support-and-ops/sample-06/demo/requirements.txt). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `aiohttp>=3.9.0`
- `browserbase==1.18.1`
- `langchain>=0.1.0`
- `playwright-stealth`
- `playwright==1.62.0`
- `python-dotenv>=1.0.0`
- `requests`
- `rich>=10.0.0`
- `selenium==4.48.0`
- `webdriver-manager`

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.
- The script uses fixed waits and does not validate authenticated page state or automate a transportation workflow after login.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/sales-support-and-ops/sample-06/demo) at commit `0000000000000000000000000000000000000000`.

Related topics: [Authentication and saved sessions](../topics/authentication.md).
