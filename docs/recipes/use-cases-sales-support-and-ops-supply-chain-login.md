# Supply chain portal login

Reference workflow for supply chain portal login; inspect its boundaries before adapting any code.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · source inspected.

**Recipe type:** reusable snippet.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/sales-support-and-ops/supply-chain-login`.
- Languages: python.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../use-cases/sales-support-and-ops/supply-chain-login/README.md).
- [Dependency manifest `use-cases/sales-support-and-ops/supply-chain-login/requirements.txt`](../../use-cases/sales-support-and-ops/supply-chain-login/requirements.txt).
- [Source `use-cases/sales-support-and-ops/supply-chain-login/tms_portal.py`](../../use-cases/sales-support-and-ops/supply-chain-login/tms_portal.py).
- Original use-case taxonomy: sales-support-and-ops.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/sales-support-and-ops/supply-chain-login
pip install -r requirements.txt
```

No launch command was established. The linked source is a starting point for integration; do not assume that importing it is side-effect free.

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [use-cases/sales-support-and-ops/supply-chain-login/requirements.txt](../../use-cases/sales-support-and-ops/supply-chain-login/requirements.txt). Alternate manifests may differ; use the documented setup path.

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

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- The script uses fixed waits and does not validate authenticated page state or automate a transportation workflow after login.

## Source

Imported source snapshot recorded in `SOURCE_MANIFEST.json`. The reviewed files are included at the local paths above.

Related topics: [Authentication and saved sessions](../topics/authentication.md).
