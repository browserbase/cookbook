"""
United Airlines Receipt Automation with Prebrowsing

This script automates United Airlines receipt lookup with optional prebrowsing
to warm up the browser session and reduce bot detection.

Environment Variables:
  PREBROWSE_MINUTES: Duration of prebrowsing in minutes (default: 2.0, set to 0 to disable)
  PREBROWSE_TYPE: Type of prebrowsing ("google", "general", or "none", default: "google")
  
Examples:
  # Run with 3 minutes of Google prebrowsing (default)
  python united_receipt.py
  
  # Run with 5 minutes of general web prebrowsing  
  PREBROWSE_MINUTES=5.0 PREBROWSE_TYPE=general python united_receipt.py
  
  # Run without prebrowsing
  PREBROWSE_TYPE=none python united_receipt.py
"""
import asyncio
import logging
import os
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.theme import Theme
from stagehand import Stagehand, browserbase
from prebrowse_python import simple_prebrowse, google_search_prebrowse
custom_theme = Theme({'info': 'cyan', 'success': 'green', 'warning': 'yellow', 'error': 'red bold', 'highlight': 'magenta', 'url': 'blue underline'})
console = Console(theme=custom_theme)
load_dotenv()

async def main():
    PREBROWSE_MINUTES = float(os.getenv('PREBROWSE_MINUTES', '2.0'))
    PREBROWSE_TYPE = os.getenv('PREBROWSE_TYPE', 'google')
    browser = await browserbase.launch(api_key=os.environ['BROWSERBASE_API_KEY'], proxies=True)
    try:
        stagehand = await Stagehand.create(browser=browser, self_heal=True)
        try:
            console.print('\n🚀 [info]Initializing Stagehand...[/]')
            page = await browser.context.new_page()
            if browser.session_id:
                console.print(f'\n[yellow]Created new session:[/] {browser.session_id}')
                console.print(f'🌐 [white]View your live browser:[/] [url]https://www.browserbase.com/sessions/{browser.session_id}[/]')
            if PREBROWSE_MINUTES > 0 and PREBROWSE_TYPE != 'none':
                console.print(f'\n🔥 [highlight]Starting {PREBROWSE_TYPE} prebrowsing ({PREBROWSE_MINUTES} min) to warm up session...[/]')
                if PREBROWSE_TYPE == 'google':
                    await google_search_prebrowse(stagehand, page, minutes=PREBROWSE_MINUTES)
                elif PREBROWSE_TYPE == 'general':
                    await simple_prebrowse(stagehand, page, minutes=PREBROWSE_MINUTES)
                console.print('✅ [success]Prebrowsing complete! Session warmed up.[/]')
            else:
                console.print('\n⚡ [warning]Skipping prebrowsing (disabled in config)[/]')
            console.print('\n🎯 [info]Now starting United Airlines automation...[/]')
            await page.goto('https://www.united.com/en/us/receipts', wait_until='domcontentloaded', timeout=30000)
            console.print('Initial navigation complete')
            console.print('\n⏳ [info]Waiting 3 seconds before handling cookies/banners...[/]')
            await asyncio.sleep(3)
            await stagehand.act("Click on the 'Confirmation or eTicket number' option", timeout=20000, page=page)
            await stagehand.act(f"Enter {os.environ['TRAVEL_CONFIRMATION_NUMBER']} as the confirmation number", timeout=20000, page=page)
            await stagehand.act(f"Enter {os.environ['TRAVEL_FIRST_NAME']} as the first name", timeout=20000, page=page)
            await stagehand.act(f"Enter {os.environ['TRAVEL_LAST_NAME']} as the last name", timeout=20000, page=page)
            await stagehand.act("Click on the 'Search' button", timeout=20000, page=page)
            await asyncio.sleep(5)
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
