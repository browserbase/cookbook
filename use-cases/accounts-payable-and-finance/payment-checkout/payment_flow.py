"""Open an operator-supplied payment page and inspect its card accordion."""
import asyncio
import os
from dotenv import load_dotenv
from stagehand import Stagehand, browserbase

load_dotenv()

async def main():
    invoice_url = os.environ["PAYMENT_URL"]
    browser = await browserbase.launch(api_key=os.environ["BROWSERBASE_API_KEY"])
    try:
        stagehand = await Stagehand.create(browser=browser)
        try:
            page = await browser.context.new_page(invoice_url)
            snapshot = await page.snapshot(include_iframes=True)
            print(snapshot.formatted_tree)
            actions = await stagehand.observe("Find the Card payment option accordion button", page=page)
            if not actions.data:
                raise RuntimeError("No card payment accordion was found")
            result = await stagehand.act(actions.data[0], page=page)
            if not result.data.success:
                raise RuntimeError(result.data.message)
            print("Card payment accordion opened")
        finally:
            await stagehand.close()
    finally:
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
