import os
import asyncio
from playwright.async_api import async_playwright
from browserbase import Browserbase
from dotenv import load_dotenv
import re

# Initialize environment variables
load_dotenv()

async def main():
    api_key = os.getenv("BROWSERBASE_API_KEY")
    project_id = os.getenv("BROWSERBASE_PROJECT_ID")
    username = os.getenv("E2OPEN_USERNAME")
    password = os.getenv("E2OPEN_PASSWORD")
    missing = [name for name, value in {
        "BROWSERBASE_API_KEY": api_key,
        "BROWSERBASE_PROJECT_ID": project_id,
        "E2OPEN_USERNAME": username,
        "E2OPEN_PASSWORD": password,
    }.items() if not value]
    if missing:
        raise RuntimeError(f"Missing required configuration: {', '.join(missing)}")

    # 1. Initialize Browserbase Client
    print("✨ Initializing Browserbase client")
    bb = Browserbase(api_key=api_key)
    
    # 2. Create Browser Session
    print("🚀 Creating new browser session")
    session = bb.sessions.create(
        project_id=project_id,
        browser_settings={
            "advanced_stealth": True,
        },
        proxies=True
    )
    
    # 3. Connect to the Session
    print("🔗 Connecting to browser session and opening page")
    browser = None
    try:
        async with async_playwright() as p:
            browser = await p.chromium.connect_over_cdp(session.connect_url)
            context = browser.contexts[0]
            page = context.pages[0]
        
            print(f"🔍 Live View: https://www.browserbase.com/sessions/{session.id}")
        
        # 4. Use the Browser
            print("🌐 Loading page")

            url = "https://na-app.tms.e2open.com/"

            await page.goto(url)
            print("🔍 Use the Live View to interact with the page")

        # Accept cookies
            await page.click("button[id='accept-button']")
            await page.wait_for_timeout(1000)

        # Type in username: 
            await page.fill("input[id='userID']", username)
            await page.wait_for_timeout(1000)
        # Enter password: 
            await page.fill("input[id='password']", password)
            await page.wait_for_timeout(3000)
        # Click submit button
            await page.evaluate("document.getElementById('userSubmit').removeAttribute('disabled')")
            await page.click("#userSubmit")
            await page.wait_for_timeout(10000)

        # Sleep for 10 seconds
            await page.wait_for_timeout(10000)

    finally:
        if browser is not None:
            await browser.close()
    
    # 4. Session Recording Link
    print("\n" + "─" * 60)
    print(f"🎥  Your session dashboard is ready\n    https://www.browserbase.com/sessions/{session.id}")

# Execute the main function
if __name__ == "__main__":
    asyncio.run(main())
