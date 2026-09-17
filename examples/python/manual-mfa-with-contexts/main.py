"""Persist a manually completed GitHub MFA login with Stagehand V4."""

import asyncio
import os
import time
from urllib.parse import urlsplit, quote

from browserbase import AsyncBrowserbase
from dotenv import load_dotenv
from pydantic import BaseModel

from stagehand import Stagehand, browserbase

load_dotenv()


class MFAStatus(BaseModel):
    mfa_required: bool


class AuthenticationState(BaseModel):
    authenticated: bool
    username: str


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value or not value.strip():
        raise RuntimeError(f"{name} is required")
    return value


async def assert_authenticated(stagehand, page) -> None:
    expected = require_env("GITHUB_USERNAME").strip()
    await page.goto("https://github.com/settings/profile", wait_until="domcontentloaded")
    url = urlsplit(await page.url())
    if url.scheme != "https" or url.netloc != "github.com" or url.path != "/settings/profile":
        raise RuntimeError("GitHub did not show the authenticated profile settings page")
    result = await stagehand.extract(
        "Read the currently signed-in GitHub account from its account menu or settings identity. "
        "Do not use usernames mentioned in page content. Return authenticated=false and username='' if uncertain.",
        AuthenticationState, page=page,
    )
    state = result.data
    if state.authenticated is not True or not isinstance(state.username, str) or state.username.strip().casefold() != expected.casefold():
        raise RuntimeError("The observed GitHub account does not match GITHUB_USERNAME")


async def first_login(context_id: str) -> None:
    browser = await browserbase.launch(
        api_key=require_env("BROWSERBASE_API_KEY"),
        browser_settings={"context": {"id": context_id, "persist": True}},
    )
    try:
        stagehand = await Stagehand.create(
            browser=browser,
        )
        try:
            pages = await browser.context.pages()
            page = pages[0] if pages else await browser.context.new_page()
            await page.goto("https://github.com/login", wait_until="domcontentloaded")
            await stagehand.act(
                "Fill the username field with %username%",
                page=page,
                variables={"username": require_env("GITHUB_USERNAME")},
            )
            await stagehand.act(
                "Fill the password field with %password%",
                page=page,
                variables={"password": require_env("GITHUB_PASSWORD")},
            )
            await stagehand.act("Click the Sign in button", page=page)

            status = await stagehand.extract(
                "Is a two-factor authentication or verification-code prompt visible?",
                MFAStatus,
                page=page,
            )
            if status.data.mfa_required:
                if not browser.session_id:
                    raise RuntimeError("The owned browser session ID is unavailable")
                print("Complete MFA in this owned session: https://www.browserbase.com/sessions/" + quote(browser.session_id, safe=""))
                deadline = time.monotonic() + 120
                while time.monotonic() < deadline:
                    current_url = await page.url()
                    if "/login" not in current_url and "/sessions/two-factor" not in current_url:
                        break
                    await asyncio.sleep(3)
                else:
                    raise TimeoutError("MFA was not completed within two minutes")

            await assert_authenticated(stagehand, page)
            print("First session account identity verified; closing before reuse")
        finally:
            await stagehand.close()
    finally:
        await browser.close()


async def verify_context(context_id: str) -> None:
    browser = await browserbase.launch(
        api_key=require_env("BROWSERBASE_API_KEY"),
        browser_settings={"context": {"id": context_id, "persist": True}},
    )
    try:
        stagehand = await Stagehand.create(
            browser=browser,
        )
        try:
            pages = await browser.context.pages()
            page = pages[0] if pages else await browser.context.new_page()
            await assert_authenticated(stagehand, page)

        finally:
            await stagehand.close()
    finally:
        await browser.close()


async def main() -> None:
    require_env("GITHUB_USERNAME")
    require_env("GITHUB_PASSWORD")
    async with AsyncBrowserbase(api_key=require_env("BROWSERBASE_API_KEY")) as api:
        context = await api.contexts.create()
        print("Created temporary Browserbase context")
        try:
            await first_login(context.id)
            await asyncio.sleep(5)
            await verify_context(context.id)
        finally:
            # The generated SDK currently sets a JSON content type on DELETE, so send an
            # explicit empty object instead of an empty body.
            await api.contexts.delete(context.id, extra_body={})
            print("Deleted temporary Browserbase context")
        print("The second session verified the same GitHub account without another login step.")
        print("Authentication reuse was verified for these two sessions; future MFA requirements may differ.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as error:
        print(f"MFA context demo failed: {error}")
        print("Docs: https://docs.stagehand.dev/v4/first-steps/introduction")
        raise
