import asyncio
import os
from pathlib import Path
from urllib.parse import quote

from dotenv import load_dotenv
from browserbase import Browserbase
from browser_use import Agent, Browser, BrowserProfile, ChatAnthropic


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


async def main():
    api_key = require_env("BROWSERBASE_API_KEY")
    project_id = require_env("BROWSERBASE_PROJECT_ID")
    model_key = require_env("ANTHROPIC_API_KEY")
    fixture = Path(__file__).with_name("fixture.html").read_text()
    fixture_url = "data:text/html;charset=utf-8," + quote(fixture)
    llm = ChatAnthropic(model="claude-sonnet-4-6", api_key=model_key)
    bb = Browserbase(api_key=api_key, timeout=10, max_retries=0)
    session = None
    browser = None
    errors = []
    result = None
    try:
        session = bb.sessions.create(project_id=project_id, keep_alive=True, api_timeout=300)
        browser = Browser(browser_profile=BrowserProfile(
            cdp_url=session.connect_url,
            allowed_domains=["cookbook.invalid"],
        ))
        agent = Agent(
            task="Read the workshop schedule already open in the browser. Return each workshop's name, time, and room. Do not navigate elsewhere or change the page.",
            initial_actions=[{"navigate": {"url": fixture_url, "new_tab": False}}],
            llm=llm,
            browser=browser,
            generate_gif=False,
        )
        result = await asyncio.wait_for(agent.run(max_steps=5), timeout=120)
        if result.is_successful() is not True or not result.final_result():
            raise RuntimeError("The browser task did not report a completed result")
    except BaseException as error:
        errors.append(error)
    finally:
        if browser is not None:
            try:
                await asyncio.wait_for(browser.stop(), timeout=10)
            except BaseException as error:
                errors.append(error)
        if session is not None:
            try:
                bb.sessions.update(session.id, project_id=project_id, status="REQUEST_RELEASE")
            except BaseException as error:
                errors.append(error)
        try:
            bb.close()
        except BaseException as error:
            errors.append(error)
    if len(errors) == 1:
        raise errors[0]
    if errors:
        raise BaseExceptionGroup("Browser task or cleanup failed", errors)
    print(result.final_result())
    return result


if __name__ == "__main__":
    load_dotenv()
    asyncio.run(main())
