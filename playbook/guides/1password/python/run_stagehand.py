import asyncio
import os
from stagehand import Stagehand, browserbase
from dotenv import load_dotenv
load_dotenv()

async def main():
    browser = await browserbase.launch(api_key=os.environ['BROWSERBASE_API_KEY'], extension_id=os.environ['EXTENSION_ID'])
    stagehand = await Stagehand.create(browser=browser, self_heal=True)
    try:
        page = await browser.context.new_page()
        await page.goto('chrome-extension://aeblfdkhhhdcdjpifhhbdiojplfjncoa/app/app.html#/page/welcome')
        await stagehand.act('click the Continue button', page=page)
        await stagehand.act('click the Sign in button', page=page)
        await asyncio.sleep(60)
        await page.goto('https://browserbase.com/sign-in')
        await asyncio.sleep(10)
    finally:
        try:
            await stagehand.close()
        finally:
            await browser.close()
if __name__ == '__main__':
    asyncio.run(main())
