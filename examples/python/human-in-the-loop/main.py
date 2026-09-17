"""Pause a Browserbase page for explicit operator review before an optional click."""

from __future__ import annotations

import os
from urllib.parse import urlparse

from browserbase import Browserbase
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

load_dotenv()


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def main() -> None:
    api_key = require_env("BROWSERBASE_API_KEY")
    target_url = require_env("TARGET_URL")
    parsed = urlparse(target_url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise RuntimeError("TARGET_URL must be an HTTPS URL without embedded credentials")

    approval_selector = os.environ.get("APPROVAL_SELECTOR", "").strip()
    session = Browserbase(api_key=api_key).sessions.create()
    browser = None
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.connect_over_cdp(session.connect_url)
            page = browser.contexts[0].pages[0]
            page.goto(target_url, wait_until="domcontentloaded")
            print(f"Review the page in Browserbase: https://www.browserbase.com/sessions/{session.id}")
            decision = input("Type approve to perform the configured click; anything else stops: ").strip().lower()
            if decision != "approve":
                print("Stopped without performing the optional action.")
                return
            if not approval_selector:
                print("Approval recorded; no APPROVAL_SELECTOR was configured, so no page action ran.")
                return
            locator = page.locator(approval_selector)
            if locator.count() != 1:
                raise RuntimeError("APPROVAL_SELECTOR must resolve to exactly one element")
            locator.click()
            print("Approved action completed. Verify the resulting page in the session replay.")
    finally:
        if browser is not None:
            browser.close()


if __name__ == "__main__":
    main()
