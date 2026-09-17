"""Load a travel page and let a CrewAI agent summarize its local recommendations."""
import os
import sys
from crewai import Agent, Crew, Task
from crewai.tools import tool
from browserbase import Browserbase
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

load_dotenv()


@tool("Read a web page")
def read_web_page(url: str) -> str:
    """Read rendered text from one URL in a Browserbase session."""
    with Browserbase(api_key=os.environ["BROWSERBASE_API_KEY"]) as client:
        session = client.sessions.create()
        with sync_playwright() as playwright:
            browser = playwright.chromium.connect_over_cdp(session.connect_url)
            try:
                page = browser.contexts[0].new_page()
                page.goto(url, wait_until="domcontentloaded")
                return page.locator("body").inner_text()
            finally:
                browser.close()


def main():
    url = sys.argv[1] if len(sys.argv) > 1 else "https://www.sftravel.com/"
    guide = Agent(role="Local travel guide", goal="Summarize verified visitor information",
                  backstory="Ground recommendations in the supplied destination website.", tools=[read_web_page])
    result = Crew(agents=[guide], tasks=[Task(
        description=f"Read {url} and summarize five useful visitor recommendations with their source URLs.",
        expected_output="Five sourced visitor recommendations.", agent=guide,
    )]).kickoff()
    print(result)


if __name__ == "__main__":
    main()
