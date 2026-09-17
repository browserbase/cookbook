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
import json
import hashlib
load_dotenv()
logger = structlog.stdlib.get_logger()
CACHE_FILE = 'stagehand_action_cache.json'

def get_cache(key: str) -> Optional[list]:
    """Get cached action by key."""
    try:
        if not os.path.exists(CACHE_FILE):
            return None
        with open(CACHE_FILE, 'r') as f:
            content = f.read().strip()
            if not content:
                return None
            cache = json.loads(content)
            return cache.get(key)
    except (json.JSONDecodeError, Exception) as e:
        logger.warning('Failed to read cache, removing corrupted file', error=str(e))
        try:
            os.remove(CACHE_FILE)
        except:
            pass
        return None

def set_cache(key: str, value: list) -> None:
    """Set cached action by key."""
    try:
        cache = {}
        if os.path.exists(CACHE_FILE):
            with open(CACHE_FILE, 'r') as f:
                content = f.read().strip()
                if content:
                    cache = json.loads(content)
        if isinstance(value, list):
            serializable_value = []
            for item in value:
                if hasattr(item, 'model_dump'):
                    serializable_value.append(item.model_dump())
                elif hasattr(item, 'dict'):
                    serializable_value.append(item.dict())
                else:
                    serializable_value.append(item)
            cache[key] = serializable_value
        else:
            cache[key] = value
        with open(CACHE_FILE, 'w') as f:
            json.dump(cache, f, indent=2)
    except (json.JSONDecodeError, Exception) as e:
        logger.warning('Failed to write cache', error=str(e))
        try:
            if os.path.exists(CACHE_FILE):
                os.remove(CACHE_FILE)
        except:
            pass

def create_cache_key(action_description: str, page_context: str='') -> str:
    """Create a unique cache key based on action description and page context."""
    combined = f'{action_description}:{page_context}'
    return hashlib.md5(combined.encode()).hexdigest()

async def cached_act(stagehand, page, action_description: str, page_context: str = '') -> None:
    cache_key = create_cache_key(action_description, page_context)
    cached_action = get_cache(cache_key)
    if cached_action:
        await stagehand.act(cached_action[0], page=page)
        return
    observed = await stagehand.observe(action_description, page=page)
    actions = observed.data
    if actions:
        set_cache(cache_key, actions)
        await stagehand.act(actions[0], page=page)
    else:
        await stagehand.act(action_description, page=page)


def get_cache_stats() -> dict:
    """Get cache statistics."""
    try:
        if not os.path.exists(CACHE_FILE):
            return {'cache_entries': 0, 'cache_file_exists': False}
        with open(CACHE_FILE, 'r') as f:
            cache = json.load(f)
            return {'cache_entries': len(cache), 'cache_file_exists': True, 'cache_keys': list(cache.keys())}
    except Exception as e:
        return {'error': str(e), 'cache_entries': 0, 'cache_file_exists': False}

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
    session = bb.sessions.create(browser_settings={'block_ads': True, 'block_popups': False, 'disable_captcha': False, 'viewport': {'width': 1024, 'height': 768}, 'verified': False}, proxies=True)
    stagehand = None
    browser = None
    try:
        cache_stats = get_cache_stats()
        logger.info('Cache stats at start', **cache_stats, ticket_id=ticket_id)
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
        await page.wait_for_timeout(20000)
        await cached_act(stagehand, page, 'Accept all cookies or confirm any popups', 'airline_a_homepage')
        await cached_act(stagehand, page, "Click the dropdown arrow button next to 'Confirmation Number' in the 'Find Your Trip By' section to open the dropdown menu.", 'airline_a_search_page')
        await cached_act(stagehand, page, "Click on 'Ticket Number' option from the dropdown menu that just opened.", 'airline_a_search_dropdown')
        await stagehand.act(f"Type '{data.ticket_number}' into the second field. It has a placeholder text saying something like 'ex. 0062112549881'", page=page)
        await stagehand.act(f"Type '{data.first_name}' into the 'First Name' field.", page=page)
        await stagehand.act(f"Type '{data.last_name}' into the 'Last Name' field.", page=page)
        await cached_act(stagehand, page, "Click the 'SEARCH' button on the form to search for the trip.", 'airline_a_search_form')
        await page.wait_for_timeout(10000)
        await cached_act(stagehand, page, "Click the 'Receipt, Share and More' dropdown", 'airline_a_trip_details')
        await cached_act(stagehand, page, "Click on 'View Receipt' or 'Receipt' option from the dropdown menu that opened.", 'airline_a_receipt_dropdown')
        await page.wait_for_timeout(10000)
        await cached_act(stagehand, page, "Locate and click the blue circle icon on the top right with the white 'PDF' image on it.", 'airline_a_receipt_page')
        logger.info('Downloading files from session', session_id=browser.session_id)
        downloaded_files = await download_files_from_session(browser.session_id)
        final_cache_stats = get_cache_stats()
        logger.info('Cache stats at end', **final_cache_stats, ticket_id=ticket_id)
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
