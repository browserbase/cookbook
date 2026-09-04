#!/usr/bin/env python3
"""
Bootstrap a Browserbase Context for a single (domain, ZIP or store_id) pair.

Runs the store-locator UI ceremony ONCE and persists the resulting cookies
into a Browserbase Context. Subsequent product fetches reuse that context
and skip the ceremony entirely.

Usage:
    python bootstrap_context.py homedepot zip 90210
    python bootstrap_context.py homedepot store_id 0915
    python bootstrap_context.py tractorsupply zip 77566

For store_id lookups, fill in STOREID_TO_ZIP in proxy_geo.py with the ZIP
for each store. The ceremony then runs against that ZIP.

Output:
    Updates contexts_map.json with:
      {"homedepot:zip:90210": "<context_id>",
       "homedepot:store_id:0915": "<context_id>", ...}
"""
import json
import os
import re
import sys
import urllib.parse
from pathlib import Path

from browserbase import Browserbase
from playwright.sync_api import sync_playwright

from proxy_geo import proxy_geo_for_zip, zip_for_store_id

API_KEY = os.environ["BROWSERBASE_API_KEY"].strip()
PROJECT_ID = os.environ["BROWSERBASE_PROJECT_ID"].strip()

HERE = Path(__file__).parent
CONTEXTS_MAP_PATH = HERE / "contexts_map.json"


def load_map() -> dict:
    if CONTEXTS_MAP_PATH.exists():
        return json.loads(CONTEXTS_MAP_PATH.read_text())
    return {}


def save_map(m: dict) -> None:
    CONTEXTS_MAP_PATH.write_text(json.dumps(m, indent=2, sort_keys=True))


def localize_homedepot(page, zip_code: str) -> None:
    """Open the store drawer, type the ZIP, select the store."""
    steps = [
        ("sleep", 15000),
        ("eval", "document.querySelector(\"[data-testid='my-store-button']\").click();"),
        ("wait_for", "#header-anchor-drawer"),
        ("sleep", 3000),
        ("fill", "[data-component^=\"store-search:SearchInput\"] input", zip_code),
        ("sleep", 500),
        ("eval", "document.querySelector(\"[data-testid='store-search-form'] button\").click();"),
        ("wait_for", "[data-testid=\"store-search-pod-testId\"]"),
        ("sleep", 5000),
        ("eval", "document.querySelector(\"[data-testid='store-search-pod-testId'] button\").click();"),
        ("sleep", 3000),
    ]
    _run_steps(page, steps, zip_code)


def localize_tractorsupply(page, zip_code: str) -> None:
    """Type ZIP into TSC store locator and make it the active store.

    Findings from step-by-step diagnostic (see diag_tsc_steps.py):
    - Sign-in modal appears intermittently (A/B bucket); dismiss if present.
    - TSC writes `lpStoreNum` + `lpZipCode` cookies (NOT myStoreNumber/storeZip).
    - All clicks via `evaluate()` to bypass any leftover overlay interception.
    - Each major step has a verification + retry — the page is genuinely flaky.
    """
    page.wait_for_timeout(8000)

    # Dismiss sign-in modal if it appeared (A/B-bucket-dependent).
    # The aria-label is on an <svg> icon — walk up to the clickable <button>.
    page.evaluate(
        "const c = document.querySelector('[aria-label=\"Close sign in popup\"]');"
        "if (c) (c.closest('button') || c).click();"
    )
    page.evaluate(
        "const b = document.querySelector('#onetrust-accept-btn-handler');"
        "if (b) b.click();"
    )
    page.wait_for_timeout(2000)

    # Open store-locator drawer, verify input appeared
    for attempt in range(3):
        page.evaluate("document.querySelector('button#storeLocation').click();")
        page.wait_for_timeout(3000)
        try:
            page.wait_for_selector(
                "div[data-testid=sl_storeSearch] input#outlined-input",
                state="visible", timeout=8000)
            print(f"  drawer opened (attempt {attempt + 1})")
            break
        except Exception:
            print(f"  drawer didn't open (attempt {attempt + 1}), retrying...")
    else:
        print("  WARNING: drawer never opened")

    # Type the ZIP — use keyboard.type so React's onChange fires per-character.
    # page.fill() can set the value directly which sometimes doesn't propagate to
    # React state, leaving the search button using the auto-filled IP-geo ZIP.
    page.click("div[data-testid=sl_storeSearch] input#outlined-input")
    page.keyboard.press("Control+A")
    page.keyboard.press("Delete")
    page.keyboard.type(zip_code, delay=50)
    page.wait_for_timeout(2000)
    actual = page.input_value("div[data-testid=sl_storeSearch] input#outlined-input")
    print(f"  zip input value: {actual!r} (expected {zip_code!r})")

    # Submit via Enter — TSC's search form listens to keypress, which is more
    # reliable than clicking the button (which can fire before state commits).
    page.keyboard.press("Enter")
    page.wait_for_timeout(2000)
    # Belt + suspenders: also click the search button explicitly
    page.evaluate('document.querySelector(\'button[data-testid="search-button"]\').click();')
    try:
        page.wait_for_selector(
            '#store-list>div a[aria-label="open Store"]',
            state="attached", timeout=15_000)
        print("  store results appeared")
    except Exception:
        print("  WARNING: store results never appeared")
    page.wait_for_timeout(3000)

    # Open the first store result — defensive against missing selectors
    page.evaluate(
        "const a = document.querySelector('#store-list>div a[aria-label=\"open Store\"]')"
        " || document.querySelector('#store-list a')"
        " || document.querySelector('[data-testid*=\"store-result\"] a');"
        " if (a) a.click();"
    )
    page.wait_for_timeout(7000)

    # Make it my store — defensive
    page.evaluate(
        "const m = document.querySelector('[data-testid=\"make-my-store-button\"]')"
        " || Array.from(document.querySelectorAll('button')).find(b => /make my store/i.test(b.textContent||''));"
        " if (m) m.click();"
    )
    page.wait_for_timeout(3000)

    # Confirmation dialog — defensive
    page.evaluate(
        "const c = document.querySelector('.MuiDialog-container button.MuiButton-containedPrimary')"
        " || document.querySelector('[role=dialog] button.MuiButton-containedPrimary');"
        " if (c) c.click();"
    )
    page.wait_for_timeout(8000)


def _run_steps(page, steps, zip_code):
    for kind, *args in steps:
        try:
            if kind == "wait_for":
                page.wait_for_selector(args[0], timeout=10_000)
            elif kind == "wait_for_state":
                page.wait_for_selector(args[0], state=args[1], timeout=10_000)
            elif kind == "click":
                page.click(args[0], timeout=5_000)
            elif kind == "fill":
                page.fill(args[0], args[1] if len(args) > 1 else zip_code, timeout=10_000)
            elif kind == "eval":
                page.evaluate(args[0])
            elif kind == "sleep":
                page.wait_for_timeout(args[0])
        except Exception as e:
            print(f"  step {kind} {args[0][:60] if args else ''!r} skipped: {type(e).__name__}")


def verify_homedepot(ctx, zip_code: str, expected_store_id: str | None = None) -> bool:
    """Confirm localization cookies were set."""
    cookies = {c["name"]: c["value"] for c in ctx.cookies()}
    delivery_zip = cookies.get("DELIVERY_ZIP")
    localizer = cookies.get("THD_LOCALIZER")
    print(f"  DELIVERY_ZIP : {delivery_zip}")
    print(f"  THD_LOCALIZER: {'set' if localizer else 'MISSING'}")
    observed_store = None
    if localizer:
        loc_dec = urllib.parse.unquote(localizer)
        store = re.findall(r'"THD_LOCSTORE"\s*:\s*"([^"]+)"', loc_dec)[:1]
        observed_store = store[0] if store else None
        print(f"  store        : {store}")
    store_matches = expected_store_id is None or observed_store == expected_store_id
    return delivery_zip == zip_code and bool(localizer) and store_matches


def verify_tractorsupply(ctx, zip_code: str, expected_store_id: str | None = None) -> bool:
    """TSC's real cookies are lpStoreNum (store#) and lpZipCode (active ZIP).
    Verified via step-by-step diagnostic — NOT myStoreNumber/storeZip as some
    references suggest."""
    cookies = {c["name"]: c["value"] for c in ctx.cookies()}
    print(f"  lpStoreNum   : {cookies.get('lpStoreNum', 'MISSING')}")
    print(f"  lpZipCode    : {cookies.get('lpZipCode', 'MISSING')}")
    print(f"  lpZipCodeNum : {cookies.get('lpZipCodeNum', 'MISSING')}")
    print(f"  sessionGeoZip: {cookies.get('sessionGeoZip', 'MISSING')}")
    # Pass = the store-locator finished AND it picked a store that matches our ZIP
    observed_store = cookies.get("lpStoreNum")
    store_matches = expected_store_id is None or observed_store == expected_store_id
    return cookies.get("lpZipCode") == zip_code and bool(observed_store) and store_matches


SITE_CONFIG = {
    "homedepot": {
        "homepage": "https://www.homedepot.com/",
        "localize": localize_homedepot,
        "verify": verify_homedepot,
    },
    "tractorsupply": {
        "homepage": "https://www.tractorsupply.com/",
        "localize": localize_tractorsupply,
        "verify": verify_tractorsupply,
    },
}


def bootstrap(domain: str, kind: str, value: str) -> str:
    """Bootstrap a Context.

    kind="zip": value is a ZIP code, type it into the search box directly.
    kind="store_id" or "store_id_4digit_hint": look up the ZIP for that store
        in proxy_geo.STOREID_TO_ZIP, then use the ZIP flow.
    """
    cfg = SITE_CONFIG[domain]

    if kind == "zip":
        zip_code = value
    elif kind in ("store_id", "store_id_4digit_hint"):
        zip_code = zip_for_store_id(domain, value)
        if not zip_code:
            raise RuntimeError(
                f"No ZIP mapping for {domain} store_id={value!r}.\n"
                f"Add an entry to STOREID_TO_ZIP in proxy_geo.py:\n"
                f'    "{domain}:{value}": "<the ZIP for that store>"'
            )
        print(f"store_id {value} -> ZIP {zip_code}")
    else:
        raise ValueError(f"unknown kind: {kind!r}")

    proxy_geo = proxy_geo_for_zip(zip_code)
    print(f"proxy geolocation: {proxy_geo}")

    bb = Browserbase(api_key=API_KEY)
    context = bb.contexts.create(project_id=PROJECT_ID)
    print(f"created context: {context.id}")

    session = bb.sessions.create(
        project_id=PROJECT_ID,
        proxies=[{"type": "browserbase", "geolocation": proxy_geo}],
        browser_settings={
            "verified": True,
            "os": "mac",
            "context": {"id": context.id, "persist": True},
        },
    )
    print(f"session: {session.id}")
    print(f"recording: https://www.browserbase.com/sessions/{session.id}")

    wait_until = "domcontentloaded"
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(session.connect_url)
        ctx = browser.contexts[0] if browser.contexts else browser.new_context()
        if domain == "tractorsupply":
            ctx.add_cookies([{
                "name": "sessionGeoZip", "value": zip_code,
                "domain": ".tractorsupply.com", "path": "/",
            }])
        page = ctx.pages[0] if ctx.pages else ctx.new_page()

        print(f"loading homepage: {cfg['homepage']}")
        page.goto(cfg["homepage"], wait_until=wait_until, timeout=90_000)

        print(f"running ceremony for ZIP {zip_code}...")
        cfg["localize"](page, zip_code)

        print("verifying localization cookies...")
        expected_store_id = value if kind in ("store_id", "store_id_4digit_hint") else None
        ok = cfg["verify"](ctx, zip_code, expected_store_id)
        browser.close()

    if not ok:
        raise RuntimeError(f"ceremony FAILED — cookies not set as expected for {domain}:{kind}:{value}")

    m = load_map()
    map_key = f"{domain}:{kind}:{value}"
    m[map_key] = context.id
    save_map(m)
    print(f"saved {map_key} -> {context.id}")
    return context.id


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__)
        return 2
    domain, kind, value = sys.argv[1], sys.argv[2], sys.argv[3]
    if domain not in SITE_CONFIG:
        print(f"unknown domain: {domain}. supported: {list(SITE_CONFIG)}")
        return 2
    bootstrap(domain, kind, value)
    return 0


if __name__ == "__main__":
    sys.exit(main())
