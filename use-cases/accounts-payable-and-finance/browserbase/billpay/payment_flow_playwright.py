import asyncio
import os
from dotenv import load_dotenv
from playwright.async_api import async_playwright
from browserbase import Browserbase

load_dotenv()

async def main():
    # payment page URL
    link = os.environ["PAYMENT_URL"]

    # Initialize Browserbase
    bb = Browserbase(api_key=os.getenv('BROWSERBASE_API_KEY'))

    # Create a session
    session = bb.sessions.create(
        project_id=os.getenv('BROWSERBASE_PROJECT_ID'),
        browser_settings={
            "advanced_stealth": True
        }
    )

    print(f"Session ID: {session.id}")

    # Get live view URL
    debug_info = bb.sessions.debug(session.id)
    print(f"🔴 LIVE VIEW: {debug_info.debuggerFullscreenUrl}\n")

    # Connect Playwright to Browserbase session
    async with async_playwright() as playwright:
        browser = await playwright.chromium.connect_over_cdp(session.connectUrl)
        context = browser.contexts[0]
        page = context.pages[0]

        # Navigate to the payment page
        print("Navigating to payment page...")
        await page.goto(link, wait_until='load')
        await page.wait_for_timeout(5000)

        # Find the payment flow iframe
        print("Finding payment flow iframe...")
        payment_iframe = None
        for frame in page.frames:
            if 'elements-inner-payment' in frame.url:
                payment_iframe = frame
                print(f"Found payment iframe: {frame.name}")
                break

        if not payment_iframe:
            print("ERROR: Could not find payment iframe")
            await asyncio.sleep(30)
            await browser.close()
            return

        # Wait for iframe content to load
        await asyncio.sleep(2)

        # Click the Card accordion inside the iframe
        xpath_in_iframe = '/html/body/div/div/div[1]/div/div/div/div/div/div/div[1]/div[1]/div/div'

        print("Clicking card accordion...")
        await payment_iframe.click(f'xpath={xpath_in_iframe}', force=True)
        print("Successfully clicked!")

        # Keep session alive for debugging
        await asyncio.sleep(30)

        print("Closing browser...")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
