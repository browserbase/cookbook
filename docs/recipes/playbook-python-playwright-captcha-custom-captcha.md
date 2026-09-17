# Custom captcha (Python, Playwright)

Demonstrate custom captcha with Playwright/Browserbase SDK.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · live workflow tested.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `playbook/python`.
- Languages: python.
- Frameworks: Playwright, Browserbase SDK.
- [Upstream setup and behavior](../../playbook/UPSTREAM_README.md).
- [Dependency manifest `playbook/python/requirements.txt`](../../playbook/python/requirements.txt).
- [Source `playbook/python/playwright/captcha/custom_captcha.py`](../../playbook/python/playwright/captcha/custom_captcha.py).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd playbook/python
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
python playwright/captcha/custom_captcha.py
```

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [playbook/python/requirements.txt](../../playbook/python/requirements.txt). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `browserbase==1.18.1`
- `playwright==1.62.0`
- `python-dotenv>=1.2.2,<2`
- `requests>=2.32,<3`
- `selenium==4.48.0`

## Caveats and verification

Source and setup metadata were inspected. A scoped live workflow check is recorded below; only its stated command, date, result, and limits are verified. Other websites, accounts, permissions, costs, and configurations remain unverified.

| Check | Date | Runtime | Command | Result and limits |
| --- | --- | --- | --- | --- |
| Live workflow tested | 2026-09-08 | `Node 24.19.0 or Python 3.13.2; live Browserbase project` | `python playwright/captcha/custom_captcha.py` | passed. Live session completed the NMLS CAPTCHA/search workflow and reported success. |

- Browserbase Playbook snapshot; inspect hardcoded URLs, credentials, IDs, and site-specific assumptions before use.
- Install the recorded shared Python requirements from the guide working directory; live site behavior remains unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/playbook/tree/001362e91bf6af47c03f16258cb1126e2043bff1/python/playwright/captcha/custom_captcha.py) at commit `001362e91bf6af47c03f16258cb1126e2043bff1`.

Related topics: [Browser configuration](../topics/browser-features.md).
