"""Shared OpenAI-compatible model configuration for the agent and browser tool."""
from __future__ import annotations

import os
from typing import Any, Mapping
from urllib.parse import urlsplit


def model_options(model: str, environment: Mapping[str, str] | None = None) -> dict[str, Any]:
    env = os.environ if environment is None else environment
    model = model.strip()
    if model.startswith("openai:"):
        model = model.removeprefix("openai:").strip()
    if not model:
        raise ValueError("A nonempty model name is required.")
    base_url = (env.get("DEEPAGENT_BASE_URL", "").strip()
                or env.get("OPENAI_BASE_URL", "").strip())
    if base_url:
        try:
            url = urlsplit(base_url)
            valid = (url.scheme in {"http", "https"} and url.hostname
                     and not url.username and not url.password
                     and not url.query and not url.fragment)
            url.port
        except ValueError:
            valid = False
        if not valid:
            raise ValueError("The model base URL must be an HTTP(S) endpoint without credentials, query, or fragment.")
    api_key = env.get("OPENAI_API_KEY", "").strip()
    if not api_key and base_url:
        api_key = env.get("BROWSERBASE_API_KEY", "").strip()
    if not api_key:
        raise ValueError("Set OPENAI_API_KEY, or BROWSERBASE_API_KEY with DEEPAGENT_BASE_URL/OPENAI_BASE_URL for a compatible gateway.")
    options: dict[str, Any] = {"model": model, "api_key": api_key}
    if base_url:
        options["base_url"] = base_url
    return options


def require_browserbase_key() -> str:
    value = os.environ.get("BROWSERBASE_API_KEY", "").strip()
    if not value:
        raise ValueError("BROWSERBASE_API_KEY is required for Browserbase tools.")
    return value
