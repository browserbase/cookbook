import asyncio
import io
import math
import os
import stat
import time
import zipfile

import requests
from playwright.async_api import async_playwright, Page
from dotenv import load_dotenv


def create_session() -> str:
    """Create one Browserbase session using the current environment."""
    response = requests.post(
        "https://api.browserbase.com/v1/sessions",
        json={"projectId": os.environ["BROWSERBASE_PROJECT_ID"]},
        headers={"x-bb-api-key": os.environ["BROWSERBASE_API_KEY"]},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["id"]


def get_zipped_downloads(session_id: str, timeout_seconds: float = 30) -> bytes:
    """Poll until a valid, nonempty download archive is available.

    Requests timeouts bound connection/read inactivity, not total transfer time.
    Check the monotonic deadline after each response before accepting its bytes.
    Only empty responses or empty ZIP archives are retried; HTTP and ZIP errors
    propagate immediately.
    """
    if not math.isfinite(timeout_seconds) or timeout_seconds <= 0:
        raise ValueError("timeout_seconds must be finite and greater than zero")
    deadline = time.monotonic() + timeout_seconds
    headers = {"x-bb-api-key": os.environ["BROWSERBASE_API_KEY"]}
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("Timed out waiting for the download archive")
        response = requests.get(
            f"https://api.browserbase.com/v1/sessions/{session_id}/downloads",
            headers=headers,
            timeout=min(30, remaining),
        )
        response.raise_for_status()
        data = response.content
        if time.monotonic() >= deadline:
            raise TimeoutError("Timed out waiting for the download archive")
        if data:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                damaged = archive.testzip()
                if damaged is not None:
                    raise zipfile.BadZipFile("Download archive failed its CRC check")
                regular_files = [
                    entry for entry in archive.infolist()
                    if not entry.is_dir()
                    and stat.S_IFMT(entry.external_attr >> 16) in (0, stat.S_IFREG)
                ]
                if regular_files:
                    if time.monotonic() >= deadline:
                        raise TimeoutError("Timed out waiting for the download archive")
                    return data
                if archive.infolist():
                    raise zipfile.BadZipFile("Download archive contains no regular files")
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("Timed out waiting for the download archive")
        time.sleep(min(1, remaining))


async def run(browser_tab: Page) -> None:
    await browser_tab.goto(
        "https://browser-tests-alpha.vercel.app/api/download-test",
        timeout=30_000,
    )
    print("Downloading the MP3 file to the remote browser...")
    async with browser_tab.expect_download(timeout=30_000) as download_info:
        await browser_tab.get_by_role("link", name="Download File").click(timeout=30_000)
    download = await download_info.value
    failure = await asyncio.wait_for(download.failure(), timeout=30)
    if failure is not None:
        raise RuntimeError(f"Remote download failed: {failure}")


async def main() -> None:
    load_dotenv()
    session_id = create_session()
    print(f"{session_id=}")
    async with async_playwright() as playwright:
        browser = await playwright.chromium.connect_over_cdp(
            "wss://connect.browserbase.com"
            f"?apiKey={os.environ['BROWSERBASE_API_KEY']}&sessionId={session_id}"
        )
        browser_tab = None
        try:
            session = await browser.new_browser_cdp_session()
            await session.send(
                "Browser.setDownloadBehavior",
                {
                    "behavior": "allow",
                    "downloadPath": "downloads",
                    "eventsEnabled": True,
                },
            )
            print(
                "Connected to Browserbase.",
                f"{browser.browser_type.name} version {browser.version}",
            )
            context = browser.contexts[0]
            browser_tab = context.pages[0]
            await run(browser_tab)
        finally:
            try:
                if browser_tab is not None:
                    await browser_tab.close()
            finally:
                await browser.close()

    print("Retrieving files downloaded to the remote browser during the session...")
    zipped_downloads = get_zipped_downloads(session_id)
    with open("downloads.zip", "xb") as file:
        file.write(zipped_downloads)
    print("Downloaded files are in the downloads.zip file.")


if __name__ == "__main__":
    asyncio.run(main())
