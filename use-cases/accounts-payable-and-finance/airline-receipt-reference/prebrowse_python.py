import asyncio
import random
from typing import List
from stagehand import Stagehand, browserbase

async def simple_prebrowse(stagehand: Stagehand, page, minutes: float=5.0, sites: List[str]=None) -> None:
    """
    Simple prebrowsing to warm up the browser session before automation.
    Randomly visits sites, scrolls, and clicks links to appear more human.
    """
    if minutes <= 0:
        return
    if sites is None:
        sites = ['https://www.google.com', 'https://news.google.com', 'https://www.youtube.com', 'https://en.wikipedia.org/wiki/Special:Random', 'https://www.bbc.com/news', 'https://www.reddit.com', 'https://stackoverflow.com']
    end_time = asyncio.get_event_loop().time() + minutes * 60
    print(f'🔥 Starting {minutes}-minute prebrowsing to warm up session...')
    while asyncio.get_event_loop().time() < end_time:
        target_url = random.choice(sites)
        try:
            print(f'📱 Visiting: {target_url}')
            await page.goto(target_url, wait_until='domcontentloaded', timeout=30000)
            try:
                await stagehand.act('Accept any cookies or dismiss any banners to proceed', timeout=5000, page=page)
            except:
                pass
            site_end = min(end_time, asyncio.get_event_loop().time() + random.uniform(30, 90))
            while asyncio.get_event_loop().time() < site_end:
                scroll_action = random.choice(['Scroll down a bit to see more content', 'Scroll up to see previous content', 'Scroll down to explore the page'])
                try:
                    await stagehand.act(scroll_action, timeout=3000, page=page)
                    await asyncio.sleep(random.uniform(1, 3))
                except:
                    pass
                if random.random() < 0.3:
                    click_actions = ['Click on an interesting article or link', 'Click on a news headline that looks interesting', 'Click on a search suggestion', 'Click on a related link']
                    try:
                        await stagehand.act(random.choice(click_actions), timeout=5000, page=page)
                        await asyncio.sleep(random.uniform(2, 5))
                        if random.random() < 0.7:
                            try:
                                await page.go_back(wait_until='domcontentloaded', timeout=10000)
                                await asyncio.sleep(random.uniform(1, 2))
                            except:
                                pass
                    except:
                        pass
                await asyncio.sleep(random.uniform(0.5, 2.5))
        except Exception as e:
            print(f'⚠️  Issue with {target_url}, continuing: {e}')
            continue
    print('✅ Prebrowsing complete! Browser session is now warmed up.')

async def google_search_prebrowse(stagehand: Stagehand, page, minutes: float=3.0) -> None:
    """
    More targeted Google-focused prebrowsing that mimics the TypeScript version.
    """
    if minutes <= 0:
        return
    search_queries = ['latest tech news', 'weather today', 'best restaurants near me', 'how to cook pasta', 'python programming tutorial', 'movie reviews 2024', 'travel destinations', 'healthy recipes']
    end_time = asyncio.get_event_loop().time() + minutes * 60
    print(f'🔍 Starting {minutes}-minute Google search prebrowsing...')
    await page.goto('https://www.google.com', wait_until='domcontentloaded', timeout=30000)
    try:
        await stagehand.act('Accept any cookies or consent', timeout=5000, page=page)
    except:
        pass
    while asyncio.get_event_loop().time() < end_time:
        query = random.choice(search_queries)
        try:
            print(f'🔎 Searching for: {query}')
            await stagehand.act(f"Search for '{query}'", timeout=10000, page=page)
            await asyncio.sleep(random.uniform(2, 4))
            for _ in range(random.randint(2, 5)):
                await stagehand.act('Scroll down to see more search results', timeout=3000, page=page)
                await asyncio.sleep(random.uniform(1, 2))
            if random.random() < 0.5:
                try:
                    await stagehand.act('Click on the first or second search result', timeout=8000, page=page)
                    await asyncio.sleep(random.uniform(3, 8))
                    await page.go_back(wait_until='domcontentloaded', timeout=10000)
                    await asyncio.sleep(random.uniform(1, 2))
                except:
                    pass
            await asyncio.sleep(random.uniform(1, 3))
        except Exception as e:
            print(f'⚠️  Search issue: {e}')
            try:
                await page.goto('https://www.google.com', wait_until='domcontentloaded', timeout=15000)
            except:
                pass
    print('✅ Google prebrowsing complete!')
