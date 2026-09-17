"""Upload one explicitly approved local file without submitting the surrounding form."""

from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlparse

from browserbase import Browserbase
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

load_dotenv()
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def main() -> None:
    api_key = require_env("BROWSERBASE_API_KEY")
    target_url = require_env("UPLOAD_TARGET_URL")
    selector = require_env("UPLOAD_SELECTOR")
    upload = Path(require_env("UPLOAD_FILE")).expanduser().resolve()
    parsed = urlparse(target_url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise RuntimeError("UPLOAD_TARGET_URL must be HTTPS without embedded credentials")
    if os.environ.get("ALLOW_UPLOAD", "").lower() != "true":
        raise RuntimeError("Set ALLOW_UPLOAD=true only after reviewing the target, selector, and file")
    if not upload.is_file() or upload.stat().st_size > MAX_UPLOAD_BYTES:
        raise RuntimeError("UPLOAD_FILE must be a regular file no larger than 10 MiB")

    session = Browserbase(api_key=api_key).sessions.create()
    browser = None
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.connect_over_cdp(session.connect_url)
            page = browser.contexts[0].pages[0]
            page.goto(target_url, wait_until="domcontentloaded")
            locator = page.locator(selector)
            if locator.count() != 1:
                raise RuntimeError("UPLOAD_SELECTOR must resolve to exactly one element")
            locator.set_input_files(str(upload))
            print("File selected; the surrounding form was not submitted.")
            print(f"Review the result: https://www.browserbase.com/sessions/{session.id}")
    finally:
        if browser is not None:
            browser.close()


if __name__ == "__main__":
    main()
