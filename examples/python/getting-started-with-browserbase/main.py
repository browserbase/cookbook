# Browserbase: Getting Started
# See README.md for full documentation
#
# Demos the three core Browserbase capabilities:
#   1. Search API  — web search without a browser
#   2. Fetch API   — lightweight HTTP fetch through Browserbase infra
#   3. Sessions    — full cloud browser controlled via Playwright + CDP

import os
import re
import argparse

from browserbase import Browserbase
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

load_dotenv()

# ============= CONFIGURATION =============
# The topic to search, fetch, and browse
SEARCH_QUERY = "Browser automation"
# =========================================


# ---------------------------------------------------------------------------
# 1. Search API — run a web search, no browser needed
# ---------------------------------------------------------------------------


def demo_search_api(bb: Browserbase) -> None:
    print("\n" + "=" * 50)
    print("1. SEARCH API")
    print("=" * 50)
    print(f'Searching the web for "{SEARCH_QUERY}"...')

    response = bb.search.web(query=SEARCH_QUERY, num_results=5)

    print(f"\nTop {len(response.results)} results:")
    for result in response.results:
        print(f"  - {result.title}")
        print(f"    {result.url}")


# ---------------------------------------------------------------------------
# 2. Fetch API — lightweight HTTP fetch, no browser session needed
# ---------------------------------------------------------------------------


def demo_fetch_api(bb: Browserbase) -> None:
    print("\n" + "=" * 50)
    print("2. FETCH API")
    print("=" * 50)

    target_url = "https://en.wikipedia.org/wiki/Browser_automation"
    print(f"Fetching {target_url} (no browser)...")

    response = bb.fetch_api.create(url=target_url, allow_redirects=True)

    print(f"  Status: {response.status_code}")
    print(f"  Content length: {len(response.content)} chars")

    # Pull the title out of the raw HTML
    title_match = re.search(r"<title[^>]*>([^<]+)</title>", response.content, re.IGNORECASE)
    title = title_match.group(1).strip() if title_match else "Unknown"
    print(f"  Page title: {title}")


# ---------------------------------------------------------------------------
# 3. Sessions + Playwright — full cloud browser via CDP
# ---------------------------------------------------------------------------


def demo_browser_session(bb: Browserbase) -> None:
    print("\n" + "=" * 50)
    print("3. BROWSER SESSION (Playwright + CDP)")
    print("=" * 50)

    # Create a session
    print("Creating a Browserbase session...")
    session = bb.sessions.create()

    print(f"Session ID: {session.id}")
    print(f"Live view: https://browserbase.com/sessions/{session.id}")

    browser = None
    try:
        print("Connecting to browser via CDP...")
        with sync_playwright() as pw:
            browser = pw.chromium.connect_over_cdp(session.connect_url)
            context = browser.contexts[0]
            page = context.pages[0] if context.pages else None
            if not page:
                raise RuntimeError("No page found — session may have failed to start.")
            print("Connected!")
            # Navigate to Wikipedia
            print(f'\nSearching Wikipedia for "{SEARCH_QUERY}"...')
            page.goto("https://www.wikipedia.org/", wait_until="domcontentloaded", timeout=30000)

            # Search
            page.fill('input[name="search"]', SEARCH_QUERY)
            page.click('button[type="submit"]')
            page.wait_for_load_state("domcontentloaded")
            page.wait_for_selector("h1", state="visible", timeout=10000)

            # Extract content
            title = page.text_content("h1") or "No title found"
            summary_text = page.locator(
                "#mw-content-text p:not(.mw-empty-elt)"
            ).first.text_content()
            summary = (summary_text or "").strip()
            headings = page.locator("#mw-content-text .mw-heading2 h2").all_text_contents()
            sections = [h.replace("[edit]", "").strip() for h in headings if h.strip()]

            print(f"\n  Title: {title}")
            print(f"  Summary: {summary}")
            print(f"  Sections ({len(sections)}):")
            for section in sections:
                print(f"    - {section}")
            print(f"\n  Session replay: https://browserbase.com/sessions/{session.id}")
    finally:
        if browser is not None:
            browser.close()
            print("  Browser closed.")
        else:
            bb.sessions.update(session.id, status="REQUEST_RELEASE")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="Run one Browserbase product example independently.")
    parser.add_argument("mode", nargs="?", choices=("browser", "search", "fetch", "all"), default="browser")
    args = parser.parse_args()
    print("=" * 50)
    print("GETTING STARTED WITH BROWSERBASE")
    print("=" * 50)
    print(f"Mode: {args.mode}\n")

    bb = Browserbase(api_key=os.environ.get("BROWSERBASE_API_KEY"))

    if args.mode in ("search", "all"):
        demo_search_api(bb)
    if args.mode in ("fetch", "all"):
        demo_fetch_api(bb)
    if args.mode in ("browser", "all"):
        demo_browser_session(bb)

    print("\n" + "=" * 50)
    print("DEMO COMPLETE!")
    print("=" * 50)


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print(f"Error: {err}")
        print("\nTroubleshooting:")
        print("  1. Check your .env file has BROWSERBASE_API_KEY")
        print("  2. Verify your API key at https://browserbase.com/settings")
        print("  3. View session logs at https://browserbase.com/sessions")
        print("Docs: https://docs.browserbase.com")
        exit(1)
