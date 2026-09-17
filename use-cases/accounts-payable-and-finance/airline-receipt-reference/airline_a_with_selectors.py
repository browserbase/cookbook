from session_downloads import download_session_files
from pydantic import BaseModel
from pathlib import Path
import os
import asyncio
import structlog
from typing import Optional
from stagehand import Stagehand, browserbase
from dotenv import load_dotenv
import httpx
import requests
from browserbase import Browserbase
load_dotenv()
logger = structlog.stdlib.get_logger()
DELTA_SELECTORS = {'dropdown_arrow': '/html[1]/body[1]/idp-my-trips-root[1]/div[2]/idp-my-trips-find[1]/idp-find-trips[1]/idp-find-trips-page[1]/div[1]/div[1]/div[3]/div[1]/idp-find-my-trips[1]/form[1]/div[1]/div[1]/div[1]/idp-dropdown[1]/div[1]/div[1]', 'ticket_number_option': '/html[1]/body[1]/idp-my-trips-root[1]/div[2]/idp-my-trips-find[1]/idp-find-trips[1]/idp-find-trips-page[1]/div[1]/div[1]/div[3]/div[1]/idp-find-my-trips[1]/form[1]/div[1]/div[1]/div[1]/idp-dropdown[1]/div[1]/div[1]/ul[1]/li[3]', 'ticket_number_field': '/html/body/idp-my-trips-root/div[2]/idp-my-trips-find/idp-find-trips/idp-find-trips-page/div/div[1]/div[3]/div/idp-find-my-trips/form/div/div[1]/div[2]/idp-input/div/div/input', 'first_name_field': '/html/body/idp-my-trips-root/div[2]/idp-my-trips-find/idp-find-trips/idp-find-trips-page/div/div[1]/div[3]/div/idp-find-my-trips/form/div/div[1]/div[3]/idp-input/div/div/input', 'last_name_field': '/html/body/idp-my-trips-root/div[2]/idp-my-trips-find/idp-find-trips/idp-find-trips-page/div/div[1]/div[3]/div/idp-find-my-trips/form/div/div[1]/div[4]/idp-input/div/div/input', 'search_button': '/html/body/idp-my-trips-root/div[2]/idp-my-trips-find/idp-find-trips/idp-find-trips-page/div/div[1]/div[3]/div/idp-find-my-trips/form/div/div[2]/div/idp-button/button', 'receipt_dropdown': '/html/body/idp-my-trips-root/div[2]/idp-my-trips-manage/idp-landing/idp-header/div/div[1]/div[3]/div/idp-header-dropdown/section/div/a/span[2]', 'view_receipt': '/html/body/idp-my-trips-root/div[2]/idp-my-trips-manage/idp-landing/idp-header/div/div[1]/div[3]/div/idp-header-dropdown/section/section/div[1]/a', 'pdf_download': '/html/body/idp-root/idp-details/div/idp-details-page/div/div/div/section/div/div[1]/div/idp-action-icons[3]/button/img'}

async def xpath_with_fallback(stagehand, page, xpath: str, fallback_instruction: str, action: str='click', value: str=None, timeout: int=5000):
    """Try xpath selector first, fallback to page.act if it fails."""
    try:
        locator = page.locator(f'xpath={xpath}')
        await page.wait_for_selector(f'xpath={xpath}', state='visible', timeout=timeout)
        if action == 'click':
            await locator.click()
        elif action == 'fill' and value is not None:
            await locator.fill(value)
        else:
            raise ValueError(f'Unsupported action: {action}')
        logger.info('XPath selector succeeded', xpath=xpath[:50] + '...', action=action)
        return True
    except Exception as e:
        logger.warning('XPath selector failed, falling back to page.act', xpath=xpath[:50] + '...', error=str(e))
        try:
            await stagehand.act(fallback_instruction, page=page)
            logger.info('Fallback page.act succeeded', instruction=fallback_instruction[:50] + '...')
            return True
        except Exception as fallback_error:
            logger.error('Both XPath and fallback failed', xpath_error=str(e), fallback_error=str(fallback_error))
            return False

async def download_files_from_session(session_id: str, download_dir: str = 'downloads') -> list[str]:
    """Return a complete, validated download batch, or no files on failure."""
    api_key = os.getenv('BROWSERBASE_API_KEY')
    if not api_key:
        logger.error('BROWSERBASE_API_KEY not found in environment variables')
        return []
    try:
        return await asyncio.to_thread(download_session_files, session_id, download_dir, api_key)
    except Exception:
        logger.error('Session download failed; no files from this batch were accepted')
        return []

class Airline ATicketInput(BaseModel):
    """Input for searching by ticket number."""
    first_name: str
    last_name: str
    ticket_number: str

async def _get_receipt_pdf_via_stagehand(data: Airline ATicketInput) -> Optional[str]:
    """Fetch receipt PDF using Stagehand and Airline A's website.

    Args:
        data: Search parameters (ticket info)
        backend: Backend to use for browser automation

    Returns:
        Path to the downloaded PDF receipt or None if not found
    """
    ticket_id = f'airline_a-ticket-{data.ticket_number}'
    bb = Browserbase(api_key=os.environ['BROWSERBASE_API_KEY'])
    session = bb.sessions.create(browser_settings={'block_ads': True, 'block_popups': False, 'disable_captcha': False, 'viewport': {'width': 1024, 'height': 768}, 'verified': False}, proxies=False)
    stagehand = None
    browser = None
    try:
        browser = await browserbase.connect(api_key=os.environ['BROWSERBASE_API_KEY'], session_id=session.id)
        stagehand = await Stagehand.create(browser=browser, self_heal=True)
        page = await browser.context.new_page()
        logger.info('Stagehand initialized', ticket_id=ticket_id)
        if browser.session_id:
            print(f'🌐 View your live browser: https://www.browserbase.com/sessions/{browser.session_id}')
        context = browser.context
        pages = await context.pages()
        if not pages:
            logger.error('Failed to get page from Stagehand', ticket_id=ticket_id)
            return None
        page = pages[-1]
        await page.goto('https://airline-a.example.invalid/my-trips/search', wait_until='domcontentloaded', timeout=60000)
        await page.wait_for_timeout(10000)
        await stagehand.act('Accept all cookies or confirm any popups', page=page)
        await xpath_with_fallback(stagehand, page, DELTA_SELECTORS['dropdown_arrow'], "Click the dropdown arrow button next to 'Confirmation Number' in the 'Find Your Trip By' section to open the dropdown menu.")
        await xpath_with_fallback(stagehand, page, DELTA_SELECTORS['ticket_number_option'], "Click on 'Ticket Number' option from the dropdown menu that just opened.")
        await page.wait_for_timeout(2000)
        await xpath_with_fallback(stagehand, page, DELTA_SELECTORS['ticket_number_field'], f"Type '{data.ticket_number}' into the second field. It has a placeholder text saying something like 'ex. 0062112549881'", action='fill', value=data.ticket_number)
        await xpath_with_fallback(stagehand, page, DELTA_SELECTORS['first_name_field'], f"Type '{data.first_name}' into the 'First Name' field.", action='fill', value=data.first_name)
        await xpath_with_fallback(stagehand, page, DELTA_SELECTORS['last_name_field'], f"Type '{data.last_name}' into the 'Last Name' field.", action='fill', value=data.last_name)
        await xpath_with_fallback(stagehand, page, DELTA_SELECTORS['search_button'], "Click the 'SEARCH' button on the form to search for the trip.")
        await page.wait_for_timeout(10000)
        await xpath_with_fallback(stagehand, page, DELTA_SELECTORS['receipt_dropdown'], "Click the 'Receipt, Share and More' dropdown")
        await xpath_with_fallback(stagehand, page, DELTA_SELECTORS['view_receipt'], "Click on 'View Receipt' or 'Receipt' option from the dropdown menu that opened.")
        await page.wait_for_timeout(15000)
        pages = await context.pages()
        page = pages[-1]
        await xpath_with_fallback(stagehand, page, DELTA_SELECTORS['pdf_download'], "Locate and click the blue circle icon on the top right with the white 'PDF' image on it.")
        await page.wait_for_timeout(10000)
        logger.info('Downloading files from session', session_id=browser.session_id)
        downloaded_files = await download_files_from_session(browser.session_id)
        if downloaded_files:
            logger.info('Successfully downloaded files', files=downloaded_files)
            return downloaded_files[0] if downloaded_files else None
        else:
            logger.warning('No files were downloaded from the session')
            return None
    except Exception as e:
        logger.exception('Error scraping Airline A receipt', error=str(e), ticket_id=ticket_id)
        return None
    finally:
        try:
            if stagehand is not None:
                await stagehand.close()
        finally:
            if browser is not None:
                await browser.close()

async def main():
    ticket_data = Airline ATicketInput(first_name=os.environ['TRAVEL_FIRST_NAME'], last_name=os.environ['TRAVEL_LAST_NAME'], ticket_number=os.environ['TRAVEL_TICKET_NUMBER'])
    await _get_receipt_pdf_via_stagehand(ticket_data)
if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
