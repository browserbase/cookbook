# Captcha listening (Python, Browserbase)

Demonstrate captcha listening with Selenium/Browserbase SDK.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `playbook/python`.
- Languages: python.
- Frameworks: Selenium, Browserbase SDK.
- [Upstream setup and behavior](../../playbook/python/selenium/stealth/README.md).
- [Dependency manifest `playbook/python/requirements.txt`](../../playbook/python/requirements.txt).
- [Source `playbook/python/selenium/stealth/captcha_listening.py`](../../playbook/python/selenium/stealth/captcha_listening.py).

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
python selenium/stealth/captcha_listening.py
```

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `CAPTCHA_TIMEOUT_SECONDS` | Recipe configuration. Configures captcha timeout seconds behavior for this recipe. Non-secret. | `10` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [playbook/python/requirements.txt](../../playbook/python/requirements.txt). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `browserbase==1.18.1`
- `playwright==1.62.0`
- `python-dotenv>=1.2.2,<2`
- `requests>=2.32,<3`
- `selenium==4.48.0`

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Browserbase Playbook snapshot; inspect hardcoded URLs, credentials, IDs, and site-specific assumptions before use.
- Install the recorded shared Python requirements from the guide working directory; live site behavior remains unverified.
- Console-event observation only: no_challenge_observed is not proof that a challenge is absent. Pending solves and late responses raise; a blocking transport request can outlast the observation deadline.
- Live check on 2026-09-08 did not complete: Live Selenium session creation succeeded, but navigation failed with WebDriverException: failed to connect to browser.

## Provenance

[Pinned upstream source](https://github.com/browserbase/playbook/tree/001362e91bf6af47c03f16258cb1126e2043bff1/python/selenium/stealth/captcha_listening.py) at commit `001362e91bf6af47c03f16258cb1126e2043bff1`.

Related topics: [Browser configuration](../topics/browser-features.md).
