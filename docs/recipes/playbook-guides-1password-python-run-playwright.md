# Run Playwright (Python, Browserbase)

Demonstrate run playwright with Playwright/Browserbase SDK.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `playbook/guides/1password/python`.
- Languages: python.
- Frameworks: Playwright, Browserbase SDK.
- [Upstream setup and behavior](../../playbook/UPSTREAM_README.md).
- [Dependency manifest `playbook/guides/1password/python/requirements.txt`](../../playbook/guides/1password/python/requirements.txt).
- [Source `playbook/guides/1password/python/run_playwright.py`](../../playbook/guides/1password/python/run_playwright.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd playbook/guides/1password/python
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
python run_playwright.py
```

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `EXTENSION_ID` | Recipe configuration. Configures extension id behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [playbook/guides/1password/python/requirements.txt](../../playbook/guides/1password/python/requirements.txt). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `browserbase==1.18.1`
- `playwright==1.62.0`
- `python-dotenv>=1.2.2,<2`
- `requests>=2.32,<3`
- `stagehand==4.0.2`

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Browserbase Playbook snapshot; inspect hardcoded URLs, credentials, IDs, and site-specific assumptions before use.
- 1Password extension guide requires external account and unpacked extension setup.
- The recorded shared manifest includes the migrated SDK dependencies. live extension login remains unverified.
- Extension upload requires EXTENSION_ZIP_PATH and creates a remote extension. Login scripts require EXTENSION_ID for an uploaded extension and account setup. Run upload and login as separate steps; cookbook verification does not perform either operation.

## Provenance

[Pinned upstream source](https://github.com/browserbase/playbook/tree/001362e91bf6af47c03f16258cb1126e2043bff1/guides/1password/python/run_playwright.py) at commit `001362e91bf6af47c03f16258cb1126e2043bff1`.

Related topics: [Authentication and saved sessions](../topics/authentication.md).
