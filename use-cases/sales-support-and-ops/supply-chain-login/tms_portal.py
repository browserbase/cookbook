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
    login_url = os.getenv("TMS_LOGIN_URL")
    username = os.getenv("TMS_USERNAME")
    password = os.getenv("TMS_PASSWORD")
    missing = [name for name, value in {
        "BROWSERBASE_API_KEY": api_key,
        "TMS_LOGIN_URL": login_url,
        "TMS_USERNAME": username,
        "TMS_PASSWORD": password,
    }.items() if not value]
    if missing:
        raise RuntimeError(f"Missing required configuration: {', '.join(missing)}")

    # 1. Initialize Browserbase Client
    print("✨ Initializing Browserbase client")
    bb = Browserbase(api_key=api_key)
    
    # 2. Create Browser Session
    print("🚀 Creating new browser session")
    session = bb.sessions.create(
        browser_settings={
            "verified": True,
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

            await page.goto(login_url)
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
