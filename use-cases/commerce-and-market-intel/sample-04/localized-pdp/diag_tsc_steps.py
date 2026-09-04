#!/usr/bin/env python3
"""Step-by-step TSC ceremony diagnostic — screenshots and cookie dump after each action."""
import json
import os
import sys
import traceback
from pathlib import Path

from browserbase import Browserbase
from playwright.sync_api import sync_playwright

API_KEY = os.environ["BROWSERBASE_API_KEY"].strip()
PROJECT_ID = os.environ["BROWSERBASE_PROJECT_ID"].strip()
HERE = Path(__file__).parent
SHOTS = HERE / "tsc_steps"
SHOTS.mkdir(exist_ok=True)

ZIP_CODE = "77566"

# Wipe previous screenshots
for p in SHOTS.glob("*.png"):
    p.unlink()


def snap(page, name, ctx=None):
    p = SHOTS / f"{name}.png"
    try:
        page.screenshot(path=str(p), full_page=False)
        print(f"  📸 {p.name}")
    except Exception as e:
        print(f"  ❌ screenshot failed: {e}")
    if ctx:
        cookies = {c["name"]: c["value"] for c in ctx.cookies()}
        relevant = {k: v for k, v in cookies.items() if any(s in k.lower() for s in ["store", "zip", "geo"])}
        print(f"  🍪 {relevant}")


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
    ctx.add_cookies([{"name": "sessionGeoZip", "value": ZIP_CODE,
                      "domain": ".tractorsupply.com", "path": "/"}])
    page = ctx.pages[0] if ctx.pages else ctx.new_page()

    print("\n[1] homepage")
    page.goto("https://www.tractorsupply.com/", wait_until="domcontentloaded", timeout=90_000)
    page.wait_for_timeout(8000)
    snap(page, "01_homepage", ctx)

    print("\n[2] dismiss sign-in modal")
    try:
        result = page.evaluate("""() => {
            const sels = [
                '[aria-label="Close sign in popup"]',
                'button[aria-label*="Close"]',
                '.MuiDialog-root button',
            ];
            const found = [];
            for (const sel of sels) {
                const els = document.querySelectorAll(sel);
                els.forEach(el => {
                    const lbl = (el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '').slice(0, 30);
                    found.push({sel, lbl: lbl.trim()});
                });
            }
            const closer = document.querySelector('[aria-label="Close sign in popup"]');
            if (closer) { closer.click(); return {clicked: true, found}; }
            return {clicked: false, found};
        }""")
        print(f"  modal dismiss: {result}")
    except Exception as e:
        print(f"  modal dismiss ERROR: {type(e).__name__}: {e}")
        traceback.print_exc()
    page.wait_for_timeout(2000)
    snap(page, "02_after_modal_dismiss", ctx)

    print("\n[3] click store-locator pill")
    try:
        info = page.evaluate("""() => {
            const btn = document.querySelector('button#storeLocation');
            if (!btn) return {found: false};
            const rect = btn.getBoundingClientRect();
            const visible = rect.width > 0 && rect.height > 0;
            btn.click();
            return {found: true, visible, text: btn.textContent.slice(0, 80)};
        }""")
        print(f"  pill click: {info}")
    except Exception as e:
        print(f"  pill click ERROR: {type(e).__name__}: {e}")
    page.wait_for_timeout(3000)
    snap(page, "03_after_pill_click", ctx)

    print("\n[4] drawer state")
    try:
        info = page.evaluate("""() => {
            const out = {};
            ['#storeLocation', 'div#storeLocation', '[role=dialog]', '.MuiDrawer-root',
             'div[data-testid=sl_storeSearch]', 'input#outlined-input'].forEach(s => {
                const el = document.querySelector(s);
                if (el) {
                    const r = el.getBoundingClientRect();
                    out[s] = { visible: r.width > 0 && r.height > 0, w: r.width, h: r.height };
                } else {
                    out[s] = null;
                }
            });
            return out;
        }""")
        print(json.dumps(info, indent=2))
    except Exception as e:
        print(f"  drawer ERROR: {type(e).__name__}: {e}")
    snap(page, "04_drawer_inspect", ctx)

    print("\n[5] try typing ZIP into input")
    typed = False
    for sel in [
        'div[data-testid=sl_storeSearch] input#outlined-input',
        '[data-testid=sl_storeSearch] input',
        'input[placeholder*="ZIP" i]',
        'input[placeholder*="zip code" i]',
    ]:
        try:
            count = page.locator(sel).count()
            print(f"  selector {sel}: count={count}")
            if count > 0:
                page.fill(sel, ZIP_CODE, timeout=5_000)
                print(f"  ✅ filled with selector: {sel}")
                typed = True
                break
        except Exception as e:
            print(f"  fail: {type(e).__name__}")
    page.wait_for_timeout(2000)
    snap(page, "05_after_zip_typed", ctx)

    if typed:
        print("\n[6] click search button")
        try:
            r = page.evaluate("""() => {
                const sels = ['button[data-testid="search-button"]', 'button[data-testid="search"]',
                              'button[type="submit"]', 'button[aria-label*="Search"]'];
                for (const s of sels) {
                    const b = document.querySelector(s);
                    if (b) { b.click(); return {sel: s, text: b.textContent.slice(0,40)}; }
                }
                return null;
            }""")
            print(f"  search click: {r}")
        except Exception as e:
            print(f"  ERROR: {e}")
        page.wait_for_timeout(5000)
        snap(page, "06_after_search", ctx)

        print("\n[7] click first store result")
        try:
            r = page.evaluate("""() => {
                const sels = ['#store-list>div a[aria-label="open Store"]',
                              '#store-list a',
                              '[data-testid*="store-result"] a',
                              '[data-testid*="store-card"]'];
                for (const s of sels) {
                    const e = document.querySelector(s);
                    if (e) { e.click(); return {sel: s, text: e.textContent.slice(0,60)}; }
                }
                return null;
            }""")
            print(f"  store open: {r}")
        except Exception as e:
            print(f"  ERROR: {e}")
        page.wait_for_timeout(8000)
        snap(page, "07_after_store_open", ctx)

        print("\n[8] click 'make my store'")
        try:
            r = page.evaluate("""() => {
                const sels = ['[data-testid="make-my-store-button"]',
                              'button[data-testid*="make-my-store"]',
                              'button:has-text("Make my store")'];
                for (const s of sels) {
                    const e = document.querySelector(s);
                    if (e) { e.click(); return {sel: s}; }
                }
                // Last resort: any button containing "make my store"
                const buttons = Array.from(document.querySelectorAll('button'));
                const mk = buttons.find(b => /make my store/i.test(b.textContent || ''));
                if (mk) { mk.click(); return {sel: 'text-match'}; }
                return null;
            }""")
            print(f"  make-my-store: {r}")
        except Exception as e:
            print(f"  ERROR: {e}")
        page.wait_for_timeout(3000)
        snap(page, "08_after_make_my_store", ctx)

        print("\n[9] click confirmation")
        try:
            r = page.evaluate("""() => {
                const sels = ['.MuiDialog-container button.MuiButton-containedPrimary',
                              '[role=dialog] button.MuiButton-containedPrimary',
                              '[role=dialog] button[type=button]'];
                for (const s of sels) {
                    const e = document.querySelector(s);
                    if (e) { e.click(); return {sel: s, text: e.textContent.slice(0,40)}; }
                }
                return null;
            }""")
            print(f"  confirm: {r}")
        except Exception as e:
            print(f"  ERROR: {e}")
        page.wait_for_timeout(8000)
        snap(page, "09_final", ctx)

    print("\n=== FINAL COOKIES ===")
    cookies = {c["name"]: c["value"] for c in ctx.cookies()}
    for name in sorted(cookies):
        if any(k in name.lower() for k in ["store", "zip", "geo", "session"]):
            print(f"  {name} = {cookies[name][:80]}")

    browser.close()
