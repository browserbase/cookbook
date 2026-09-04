#!/usr/bin/env python3
"""
Fetch a localized product page using a pre-bootstrapped Browserbase Context.

This is the FAST PATH — it spawns a session attached to an already-localized
Context (cookies set during bootstrap), skips the store-locator ceremony,
and navigates straight to the product URL.

Usage:
    python fetch_product.py homedepot zip 90210 https://www.homedepot.com/p/.../320243591
    python fetch_product.py homedepot store_id 0915 https://www.homedepot.com/p/.../333515977
    python fetch_product.py tractorsupply zip 77566 https://www.tractorsupply.com/tsc/product/...

Returns:
    Writes <out_dir>/<domain>_<product_id>_<key>.html with the rendered HTML.
    Prints PASS / FAIL based on localization signals.
"""
import json
import os
import re
import sys
import time
import urllib.parse
from pathlib import Path

from browserbase import Browserbase
from playwright.sync_api import sync_playwright

from proxy_geo import proxy_geo_for_zip, zip_for_store_id

API_KEY = os.environ["BROWSERBASE_API_KEY"].strip()
PROJECT_ID = os.environ["BROWSERBASE_PROJECT_ID"].strip()

HERE = Path(__file__).parent
CONTEXTS_MAP_PATH = HERE / "contexts_map.json"
OUT_DIR = HERE / "output"
OUT_DIR.mkdir(exist_ok=True)


def load_context_id(domain: str, kind: str, value: str) -> str:
    if not CONTEXTS_MAP_PATH.exists():
        raise RuntimeError("contexts_map.json missing — run bootstrap_context.py first")
    m = json.loads(CONTEXTS_MAP_PATH.read_text())
    key = f"{domain}:{kind}:{value}"
    if key not in m:
        raise RuntimeError(
            f"no context for {key} — run: python bootstrap_context.py {domain} {kind} {value}")
    return m[key]


def _resolve_zip(domain: str, kind: str, value: str) -> str:
    if kind == "zip":
        return value
    if kind in ("store_id", "store_id_4digit_hint"):
        zip_code = zip_for_store_id(domain, value)
        if not zip_code:
            raise RuntimeError(
                f"No ZIP mapping for {domain} store_id={value!r}. "
                f"Add it to STOREID_TO_ZIP in proxy_geo.py first.")
        return zip_code
    raise ValueError(f"unknown kind: {kind!r}")


def fetch(domain: str, kind: str, value: str, product_url: str,
          max_retries: int = 2) -> dict:
    """Fetch with up to `max_retries` retries on Akamai 403 (intermittent)."""
    last_result = None
    for attempt in range(max_retries + 1):
        last_result = _fetch_once(domain, kind, value, product_url, attempt)
        # Retry on Akamai block (403 / tiny HTML) — fresh session, same context
        if last_result["status"] != 403 and last_result.get("html_bytes", 0) > 100_000:
            return last_result
        if attempt < max_retries:
            print(f"  Akamai 403 (attempt {attempt + 1}/{max_retries + 1}), retrying...")
    return last_result


def _fetch_once(domain: str, kind: str, value: str, product_url: str, attempt: int) -> dict:
    context_id = load_context_id(domain, kind, value)
    zip_code = _resolve_zip(domain, kind, value)
    proxy_geo = proxy_geo_for_zip(zip_code)

    bb = Browserbase(api_key=API_KEY)
    # persist=False: read-only attach. Faster session start, no write-back of cookies.
    session = bb.sessions.create(
        project_id=PROJECT_ID,
        proxies=[{"type": "browserbase", "geolocation": proxy_geo}],
        browser_settings={
            "verified": True,
            "os": "mac",
            "context": {"id": context_id, "persist": False},
        },
    )

    t0 = time.time()
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(session.connect_url)
        ctx = browser.contexts[0] if browser.contexts else browser.new_context()
        page = ctx.pages[0] if ctx.pages else ctx.new_page()

        resp = page.goto(product_url, wait_until="domcontentloaded", timeout=90_000)
        page.wait_for_timeout(5000)

        # Wait for body to exist (HD keeps body hidden until React mounts).
        try:
            page.wait_for_function("document.body !== null", timeout=10_000)
        except Exception as e:
            print(f"  body wait skipped: {type(e).__name__}")

        # Incremental scroll to trigger ALL lazy-load intersection observers.
        # Single jump-scroll skips intermediate sections (related products,
        # reviews, recommendations) that wait for the viewport to pause on them.
        try:
            page.evaluate("""async () => {
                const step = window.innerHeight * 0.8;
                const total = document.body.scrollHeight;
                for (let y = 0; y < total + step; y += step) {
                    window.scrollTo(0, y);
                    await new Promise(r => setTimeout(r, 600));
                }
                window.scrollTo(0, 0);  // return to top
            }""")
        except Exception as e:
            print(f"  scroll skipped: {type(e).__name__}: {e}")

        # Wait for any network requests triggered by scrolling to settle.
        try:
            page.wait_for_load_state("networkidle", timeout=15_000)
        except Exception:
            pass  # acceptable — some sites have always-on heartbeats

        # Retry page.content() — HD SPA can re-navigate mid-read
        html = ""
        for _ in range(3):
            try:
                html = page.content()
                break
            except Exception:
                page.wait_for_timeout(2000)
        status = resp.status if resp else None
        final_url = page.url
        cookies = {c["name"]: c["value"] for c in ctx.cookies()}
        browser.close()

    duration_ms = int((time.time() - t0) * 1000)
    pass_, signals = check_localized(
        domain, zip_code, status, html, cookies, product_url, final_url)

    # Save HTML
    product_id = product_url.rstrip("/").split("/")[-1][:60]
    localization_key = re.sub(r"[^A-Za-z0-9_.-]+", "_", f"{kind}_{value}")[:80]
    out_file = OUT_DIR / f"{domain}_{product_id}_{localization_key}.html"
    out_file.write_text(html)

    return {
        "domain": domain,
        "kind": kind,
        "value": value,
        "zip": zip_code,
        "url": product_url,
        "final_url": final_url,
        "session_id": session.id,
        "status": status,
        "html_bytes": len(html),
        "duration_ms": duration_ms,
        "pass": pass_,
        "signals": signals,
        "html_path": str(out_file),
    }


def check_localized(
    domain: str,
    zip_code: str,
    status: int,
    html: str,
    cookies: dict,
    requested_url: str,
    final_url: str,
) -> tuple[bool, dict]:
    requested = urllib.parse.urlparse(requested_url)
    final = urllib.parse.urlparse(final_url)
    product_id = requested.path.rstrip("/").split("/")[-1]
    product_page_matches = (
        bool(product_id)
        and requested.hostname == final.hostname
        and product_id in final.path.rstrip("/").split("/")
    )
    if domain == "homedepot":
        delivery_zip = cookies.get("DELIVERY_ZIP")
        localizer = cookies.get("THD_LOCALIZER", "")
        loc_dec = urllib.parse.unquote(localizer) if localizer else ""
        store = re.findall(r'"THD_LOCSTORE"\s*:\s*"([^"]+)"', loc_dec)[:1]
        signals = {
            "DELIVERY_ZIP": delivery_zip,
            "localized_store": store,
            "zip_in_html_count": html.count(zip_code),
            "product_page_matches": product_page_matches,
        }
        # Trust the cookies — they're the authoritative localization signal on HD.
        # `zip_in_html` only appears after lazy-loaded price section renders;
        # treat it as a soft signal, not a fail.
        ok = (status == 200
              and delivery_zip == zip_code
              and bool(store)
              and product_page_matches
              and len(html) > 400_000)
        return ok, signals

    if domain == "tractorsupply":
        store = re.findall(r'"store(?:Number|Name|Id)"\s*:\s*"?([^",]+)"?', html)[:1]
        signals = {
            "lpStoreNum": cookies.get("lpStoreNum"),
            "lpZipCode": cookies.get("lpZipCode"),
            "store_in_html": store,
            "zip_in_html_count": html.count(zip_code),
            "product_page_matches": product_page_matches,
        }
        # Trust the cookies (lpZipCode + lpStoreNum). HTML ZIP echo is a soft signal.
        ok = (status == 200
              and cookies.get("lpZipCode") == zip_code
              and bool(cookies.get("lpStoreNum"))
              and product_page_matches
              and len(html) > 400_000)
        return ok, signals

    return False, {}


def main() -> int:
    if len(sys.argv) != 5:
        print(__doc__)
        return 2
    domain, kind, value, product_url = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    result = fetch(domain, kind, value, product_url)
    print(json.dumps(result, indent=2))
    return 0 if result["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
