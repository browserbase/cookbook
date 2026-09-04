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
load_dotenv()
logger = structlog.stdlib.get_logger()

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

class DeltaTicketInput(BaseModel):
    """Input for searching by ticket number."""
    first_name: str
    last_name: str
    ticket_number: str

async def _get_receipt_pdf_via_stagehand(data: DeltaTicketInput) -> Optional[str]:
    """Fetch receipt PDF using Stagehand and Delta's website.

    Args:
        data: Search parameters (ticket info)
        backend: Backend to use for browser automation

    Returns:
        Path to the downloaded PDF receipt or None if not found
    """
    ticket_id = f'delta-ticket-{data.ticket_number}'
    stagehand = None
    browser = None
    try:
        browser = await browserbase.launch(api_key=os.environ['BROWSERBASE_API_KEY'], proxies=True)
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
        await page.goto('https://www.delta.com/my-trips/search', wait_until='domcontentloaded', timeout=60000)
        await page.wait_for_timeout(20000)
        await stagehand.act('Accept all cookies or confirm any popups', page=page)
        await stagehand.act("Click the dropdown arrow button next to 'Confirmation Number' in the 'Find Your Trip By' section to open the dropdown menu.", page=page)
        await stagehand.act("Click on 'Ticket Number' option from the dropdown menu that just opened.", page=page)
        await stagehand.act(f"Type '{data.ticket_number}' into the second field. It has a placeholder text saying something like 'ex. 0062112549881'", page=page)
        await stagehand.act(f"Type '{data.first_name}' into the 'First Name' field.", page=page)
        await stagehand.act(f"Type '{data.last_name}' into the 'Last Name' field.", page=page)
        await stagehand.act("Click the 'SEARCH' button on the form to search for the trip.", page=page)
        await page.wait_for_timeout(10000)
        await stagehand.act("Click the 'Receipt, Share and More' dropdown", page=page)
        await stagehand.act("Click on 'View Receipt' or 'Receipt' option from the dropdown menu that opened.", page=page)
        await page.wait_for_timeout(10000)
        await stagehand.act("Locate and click the blue circle icon on the top right with the white 'PDF' image on it.", page=page)
        logger.info('Downloading files from session', session_id=browser.session_id)
        downloaded_files = await download_files_from_session(browser.session_id)
        if downloaded_files:
            logger.info('Successfully downloaded files', files=downloaded_files)
            return downloaded_files[0] if downloaded_files else None
        else:
            logger.warning('No files were downloaded from the session')
            return None
    except Exception as e:
        logger.exception('Error scraping Delta receipt', error=str(e), ticket_id=ticket_id)
        return None
    finally:
        try:
            if stagehand is not None:
                await stagehand.close()
        finally:
            if browser is not None:
                await browser.close()

async def main():
    ticket_data = DeltaTicketInput(first_name=os.environ['TRAVEL_FIRST_NAME'], last_name=os.environ['TRAVEL_LAST_NAME'], ticket_number=os.environ['TRAVEL_TICKET_NUMBER'])
    await _get_receipt_pdf_via_stagehand(ticket_data)
if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
