"""Environment-driven configuration for the demo."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal

BrowserMode = Literal["browserbase", "local"]
HarnessMode = Literal["tools", "code"]




# Stagehand takes "provider/model" names. Each provider reads its own key, so
# the model Stagehand uses for act/observe/extract does not have to come from
# the same vendor as the model driving the agent loop.
PROVIDER_KEY_ENV: dict[str, tuple[str, ...]] = {
    "anthropic": ("ANTHROPIC_API_KEY",),
    "openai": ("OPENAI_API_KEY",),
    "google": ("GOOGLE_API_KEY", "GEMINI_API_KEY"),
}


@dataclass(frozen=True)
class Config:
    browser_mode: BrowserMode
    harness_mode: HarnessMode
    headless: bool
    # When both are None, Stagehand's act/observe/extract run on the Browserbase
    # Model Gateway: Browserbase picks the model and bills it to your account, so
    # the demo needs no provider key at all. Requires a Browserbase session.
    stagehand_model: str | None
    stagehand_model_api_key: str | None
    claude_model: str | None
    target_url: str | None
    step_delay_ms: int
    action_delay_ms: int

    @property
    def uses_model_gateway(self) -> bool:
        return self.stagehand_model is None


def required_env(name: str, reason: str) -> str:
    value = (os.environ.get(name) or "").strip()
    if not value:
        raise SystemExit(f"{name} is required {reason}.")
    return value


def _resolve_stagehand_model(
    model_name: str, browser_mode: BrowserMode
) -> tuple[str | None, str | None]:
    """Decide between the Browserbase Model Gateway and an explicit provider key."""
    if not model_name:
        if browser_mode != "browserbase":
            raise SystemExit(
                "No RETAILER_DEMO_MODEL_NAME set, so Stagehand would use the Browserbase Model "
                "Gateway -- but that needs a Browserbase session, and RETAILER_DEMO_BROWSER is "
                "'local'. Either set RETAILER_DEMO_BROWSER=browserbase (with BROWSERBASE_API_KEY), "
                "or name a model with RETAILER_DEMO_MODEL_NAME and set that provider's key."
            )
        return None, None
    return model_name, _provider_api_key(model_name)


def _provider_api_key(model_name: str) -> str:
    provider = model_name.split("/", 1)[0]
    candidates = PROVIDER_KEY_ENV.get(provider)
    if candidates is None:
        raise SystemExit(
            f"RETAILER_DEMO_MODEL_NAME='{model_name}' uses provider '{provider}', which this demo "
            f"does not know how to authenticate. Use one of: {', '.join(sorted(PROVIDER_KEY_ENV))}."
        )
    for name in candidates:
        value = (os.environ.get(name) or "").strip()
        if value:
            return value
    raise SystemExit(
        f"{' or '.join(candidates)} is required for RETAILER_DEMO_MODEL_NAME='{model_name}' "
        "(the model Stagehand uses for act/observe/extract)."
    )


def _number_from_env(name: str, fallback: int) -> int:
    raw = (os.environ.get(name) or "").strip()
    if not raw:
        return fallback
    try:
        parsed = int(float(raw))
    except ValueError:
        raise SystemExit(f"{name} must be a nonnegative number of milliseconds.") from None
    if parsed < 0:
        raise SystemExit(f"{name} must be a nonnegative number of milliseconds.")
    return parsed


def _browser_mode_from_env() -> BrowserMode:
    configured = (os.environ.get("RETAILER_DEMO_BROWSER") or "").strip().lower()
    if configured in ("browserbase", "local"):
        return configured  # type: ignore[return-value]
    if configured:
        raise SystemExit("RETAILER_DEMO_BROWSER must be 'browserbase' or 'local'.")
    return "browserbase" if (os.environ.get("BROWSERBASE_API_KEY") or "").strip() else "local"


def _harness_mode_from_env() -> HarnessMode:
    configured = (os.environ.get("RETAILER_DEMO_MODE") or "").strip().lower()
    if configured in ("tools", "code"):
        return configured  # type: ignore[return-value]
    if configured:
        raise SystemExit("RETAILER_DEMO_MODE must be 'tools' or 'code'.")
    return "tools"


def load_config() -> Config:
    headless = os.environ.get("STAGEHAND_HEADLESS") == "1" or os.environ.get("CI") == "true"
    optional_claude_model = (os.environ.get("RETAILER_DEMO_CLAUDE_MODEL") or "").strip()
    target_url = (os.environ.get("RETAILER_DEMO_URL") or "").strip()
    browser_mode = _browser_mode_from_env()
    model_name, model_api_key = _resolve_stagehand_model(
        (os.environ.get("RETAILER_DEMO_MODEL_NAME") or "").strip(), browser_mode
    )

    return Config(
        browser_mode=browser_mode,
        harness_mode=_harness_mode_from_env(),
        headless=headless,
        stagehand_model=model_name,
        stagehand_model_api_key=model_api_key,
        claude_model=optional_claude_model or None,
        target_url=target_url or None,
        step_delay_ms=_number_from_env("RETAILER_DEMO_STEP_DELAY_MS", 100 if headless else 1800),
        action_delay_ms=_number_from_env("RETAILER_DEMO_ACTION_DELAY_MS", 50 if headless else 900),
    )
