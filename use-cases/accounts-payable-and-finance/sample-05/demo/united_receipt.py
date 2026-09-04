import asyncio
import logging
import os
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.theme import Theme
from stagehand import Stagehand, browserbase
custom_theme = Theme({'info': 'cyan', 'success': 'green', 'warning': 'yellow', 'error': 'red bold', 'highlight': 'magenta', 'url': 'blue underline'})
console = Console(theme=custom_theme)
load_dotenv()

async def main():
    browser = await browserbase.launch(api_key=os.environ['BROWSERBASE_API_KEY'], proxies=True)
    try:
        stagehand = await Stagehand.create(browser=browser, self_heal=True)
        try:
            console.print('\n🚀 [info]Initializing Stagehand...[/]')
            page = await browser.context.new_page()
            if browser.session_id:
                console.print(f'\n[yellow]Created new session:[/] {browser.session_id}')
                console.print(f'🌐 [white]View your live browser:[/] [url]https://www.browserbase.com/sessions/{browser.session_id}[/]')
            await page.goto('https://www.united.com/en/us/receipts', wait_until='domcontentloaded', timeout=30000)
            console.print('Initial navigation complete')
            console.print('\n⏳ [info]Waiting 3 seconds before handling cookies/banners...[/]')
            await asyncio.sleep(3)
            await stagehand.act("Click on the 'Confirmation or eTicket number' option", timeout=20000, page=page)
            await stagehand.act(f"Enter {os.environ['TRAVEL_CONFIRMATION_NUMBER']} as the confirmation number", timeout=20000, page=page)
            console.print(stagehand)
            await stagehand.act(f"Enter {os.environ['TRAVEL_FIRST_NAME']} as the first name", timeout=20000, page=page)
            await stagehand.act(f"Enter {os.environ['TRAVEL_LAST_NAME']} as the last name", timeout=20000, page=page)
            await stagehand.act("Click on the 'Search' button", timeout=20000, page=page)
            await asyncio.sleep(5)
            console.print(await stagehand.metrics())
            console.print('\n⏹️  [warning]Closing session...[/]')
            console.print('✅ [success]Session closed successfully![/]')
            console.rule('[bold]End of Example[/]')
        finally:
            await stagehand.close()
    finally:
        await browser.close()
if __name__ == '__main__':
    console.print('\n', Panel('[light_gray]Stagehand 🤘 United Receipt Example[/]', border_style='green', padding=(1, 10)))
    asyncio.run(main())
