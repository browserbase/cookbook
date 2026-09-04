#!/usr/bin/env python3
"""Diagnostic: open TSC homepage and dump what's actually on the page."""
import json
import os
import sys
from pathlib import Path

from browserbase import Browserbase
from playwright.sync_api import sync_playwright

API_KEY = os.environ["BROWSERBASE_API_KEY"].strip()
PROJECT_ID = os.environ["BROWSERBASE_PROJECT_ID"].strip()
HERE = Path(__file__).parent

bb = Browserbase(api_key=API_KEY)
session = bb.sessions.create(
    project_id=PROJECT_ID,
    proxies=[{"type": "browserbase", "geolocation": {"country": "US", "state": "TX", "city": "HOUSTON"}}],
    browser_settings={"verified": True, "os": "mac"},
)
print(f"session: {session.id}")
print(f"recording: https://www.browserbase.com/sessions/{session.id}")

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp(session.connect_url)
    ctx = browser.contexts[0] if browser.contexts else browser.new_context()
    page = ctx.pages[0] if ctx.pages else ctx.new_page()

    # Try domcontentloaded first
    print("\n=== goto with domcontentloaded ===")
    page.goto("https://www.tractorsupply.com/", wait_until="domcontentloaded", timeout=90_000)
    page.wait_for_timeout(8000)
    print(f"title: {page.title()}")
    print(f"url:   {page.url}")
    print(f"html bytes: {len(page.content())}")

    # Check if Akamai blocked us
    html = page.content()
    if "Reference #" in html or "Pardon Our Interruption" in html:
        print("!!! AKAMAI BLOCK PAGE DETECTED !!!")
        snippet = html[:2000]
        print(snippet)
        browser.close()
        sys.exit(1)

    # Hunt for store-related elements
    print("\n=== Store-related elements ===")
    store_elements = page.evaluate("""() => {
        const out = [];
        document.querySelectorAll('button, a, [role=button]').forEach(el => {
            const text = (el.textContent || '').trim().slice(0, 80);
            const id = el.id || '';
            const dt = el.getAttribute('data-testid') || '';
            const cls = (el.className || '').toString().slice(0, 60);
            const label = el.getAttribute('aria-label') || '';
            const combined = (text + ' ' + id + ' ' + dt + ' ' + label).toLowerCase();
            if (combined.includes('store') || combined.includes('locat') || combined.includes('zip')) {
                out.push({ tag: el.tagName, id, dataTestId: dt, ariaLabel: label, text, classes: cls });
            }
        });
        return out.slice(0, 20);
    }""")
    print(json.dumps(store_elements, indent=2))

    # Check for the specific selectors the customer's script expects
    print("\n=== Expected selectors check ===")
    selectors = [
        "#store-locator__my-store",
        "#storeLocation",
        "button#storeLocation",
        "[data-testid='my-store-button']",
        "[data-testid=sl_storeSearch]",
        "[aria-label*='store']",
        "[aria-label*='Store']",
        "#onetrust-accept-btn-handler",
        "header",
        "footer",
    ]
    for sel in selectors:
        try:
            count = page.locator(sel).count()
            print(f"  {sel:50s}: count={count}")
        except Exception as e:
            print(f"  {sel:50s}: err={type(e).__name__}")

    # Take a screenshot
    out = HERE / "tsc_diag.png"
    page.screenshot(path=str(out), full_page=False)
    print(f"\nscreenshot: {out}")

    # Save the raw HTML for offline inspection
    (HERE / "tsc_diag.html").write_text(html)
    print(f"html dump:  {HERE / 'tsc_diag.html'}")

    browser.close()
