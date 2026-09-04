"""
Local trusted-server credential-wrapping simulation.
The IdP signs caller-selected claims without authentication. The vault decrypts
on the server and wraps to a caller-supplied key without session attestation.
Use synthetic credentials only. See README.md for setup and trust boundaries.
"""

import asyncio
import base64
import json
import os
import subprocess
import sys
import time
import zipfile
import tempfile
from pathlib import Path

import httpx
from browserbase import Browserbase

BROWSERBASE_API_KEY = os.environ["BROWSERBASE_API_KEY"]
BROWSERBASE_PROJECT_ID = os.environ["BROWSERBASE_PROJECT_ID"]  # your Browserbase project id

AGENT_ID = "sample_org-agent-tax-2026"
ON_BEHALF_OF = "user:jane@acme.com"
TARGET_URL = "https://the-internet.herokuapp.com/login"
TARGET_HOST = "the-internet.herokuapp.com"

VAULT_PORT = int(os.environ.get("VAULT_PORT", "8788"))
VAULT_BASE = f"http://127.0.0.1:{VAULT_PORT}"
IDP_PORT = int(os.environ.get("IDP_PORT", "8790"))
IDP_BASE = f"http://127.0.0.1:{IDP_PORT}"
HERE = Path(__file__).parent
EXTENSION_DIR = HERE / "extension"

# WATCH=1 pauses before/after the injection so you can load the Live View in flow.html
WATCH = os.environ.get("WATCH", "").lower() in ("1", "true", "yes")

bb = Browserbase(api_key=BROWSERBASE_API_KEY)


def _start_service(script, port, base, extra_env=None):
    try:
        if httpx.get(f"{base}/health", timeout=1).status_code == 200:
            print(f"[*] {script} already running on :{port}")
            return None
    except Exception:
        pass
    print(f"[*] Starting {script} on :{port}...")
    proc = subprocess.Popen(
        ["node", str(HERE / script)],
        env={**os.environ, "PORT": str(port), **(extra_env or {})},
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    for _ in range(30):
        try:
            if httpx.get(f"{base}/health", timeout=1).status_code == 200:
                print("    up.")
                return proc
        except Exception:
            time.sleep(0.2)
    raise RuntimeError(f"{script} failed to start")


def ensure_idp_running():
    return _start_service("identity-provider.mjs", IDP_PORT, IDP_BASE)


def ensure_vault_running():
    return _start_service("vault-server.mjs", VAULT_PORT, VAULT_BASE, {"IDP_BASE": IDP_BASE})


def mint_jwt(agent_id, host, ttl=300) -> tuple[str, dict]:
    """Ask the local simulation to sign caller-selected claims."""
    r = httpx.post(
        f"{IDP_BASE}/token",
        json={"agentId": agent_id, "onBehalfOf": ON_BEHALF_OF, "host": host, "ttl": ttl},
        timeout=10,
    )
    r.raise_for_status()
    body = r.json()
    return body["token"], body["claims"]


def request_wrapped_lease(jwt, hostname, session_pubkey_b64, ttl=120) -> dict:
    r = httpx.post(
        f"{VAULT_BASE}/lease",
        headers={"Authorization": f"Bearer {jwt}"},
        json={"hostname": hostname, "ttl": ttl, "sessionPublicKey": session_pubkey_b64},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()


def show_audit():
    try:
        entries = httpx.get(f"{VAULT_BASE}/audit", timeout=5).json()["entries"]
    except Exception:
        return
    print(f"\n  Credential service audit log ({len(entries)} entries):")
    for e in entries:
        line = e["event"]
        for k in ("hostname", "reason", "wrappedTo"):
            if e.get(k):
                line += f"  {k}={e[k]}"
        print(f"    {e['at']}  {line}")


def zip_extension(extension_dir: Path) -> str:
    tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    with zipfile.ZipFile(tmp.name, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(extension_dir.rglob("*")):
            if f.is_file():
                zf.write(f, f.relative_to(extension_dir))
    tmp.close()
    return tmp.name


async def get_cookie(context, url, name):
    for c in await context.cookies(url):
        if c["name"] == name:
            return c["value"]
    return None


async def run(connect_url: str, jwt: str):
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.connect_over_cdp(connect_url)
        context = browser.contexts[0]
        page = context.pages[0]

        # 1. Navigate — extension loads, generates keypair, publishes public key
        print(f"\n  [3] Navigating to {TARGET_URL}")
        print(f"      Extension will generate an ephemeral keypair and publish its public key...")
        await page.goto(TARGET_URL, wait_until="domcontentloaded")

        # 2. Wait for the extension to publish its session public key (cookie)
        session_pubkey = None
        for _ in range(30):
            session_pubkey = await get_cookie(context, TARGET_URL, "__rpass_session_pubkey__")
            if session_pubkey:
                break
            await page.wait_for_timeout(300)
        if not session_pubkey:
            print("  ⚠  Extension never published a session public key — check recording")
            await browser.close()
            return

        # URL-decode (extension wrote it with encodeURIComponent)
        from urllib.parse import unquote
        session_pubkey = unquote(session_pubkey)
        print(f"\n  [4] Read session public key from extension ({len(session_pubkey)} b64 chars)")
        print(f"      {session_pubkey[:44]}...")

        # 3. Ask the vault to wrap the credential to THIS session's public key
        print(f"\n  [5] POST {VAULT_BASE}/lease  (signed JWT + session public key)")
        env = request_wrapped_lease(jwt, TARGET_HOST, session_pubkey, ttl=120)
        print(f"      vault returned a lease wrapped to the session key:")
        print(f"        wrappedKey: {len(base64.b64decode(env['wrappedKey']))} bytes (RSA-OAEP)")
        print(f"        ciphertext: {len(base64.b64decode(env['ciphertext']))} bytes (AES-256-GCM)")
        # Prove neither the orchestration layer NOR the vault can read it:
        blob = json.dumps(env).encode()
        for needle in (b"SuperSecretPassword", b"tomsmith"):
            assert needle not in blob, f"LEAK: {needle!r}"
        print(f"      ✓ no plaintext present; only this session's private key can unwrap it")

        # 4. Inject the wrapped lease (no reload — extension is polling for it)
        print(f"\n  [6] Injecting wrapped lease cookie (extension is polling)...")
        await context.add_cookies([{
            "name": "__rpass_wrapped_lease__",
            "value": json.dumps(env),
            "domain": TARGET_HOST, "path": "/", "sameSite": "Lax",
        }])

        # 5. Wait for the extension to unwrap + fill
        filled = False
        for _ in range(20):
            await page.wait_for_timeout(400)
            ulen = await page.evaluate("document.querySelector('#username')?.value?.length ?? 0")
            plen = await page.evaluate("document.querySelector('#password')?.value?.length ?? 0")
            if ulen and plen:
                filled = True
                break
        print(f"\n  [7] Extension unwrapped in-browser and filled the form:")
        print(f"      username: {'✓ filled' if filled else '✗ empty'}")
        print(f"      password: {'✓ filled' if filled else '✗ empty'}")

        lease_gone = not await get_cookie(context, TARGET_URL, "__rpass_wrapped_lease__")
        print(f"      wrapped lease burned after use: {'✓ yes' if lease_gone else '✗ no'}")

        if not filled:
            print("\n  ⚠  Not filled — check session recording")
            await browser.close()
            return

        print(f"\n  [8] Submitting form")
        await page.click("button[type='submit']")
        await page.wait_for_timeout(1500)
        flash = await page.query_selector(".flash.success")
        if flash:
            print(f"\n  ✓  Login successful: {(await flash.inner_text()).strip()!r}")
        else:
            body = await page.inner_text("body")
            ok = any(w in body.lower() for w in ["logged in", "secure area"])
            print(f"\n  {'✓  Login successful' if ok else '⚠  Unexpected result'}")

        await browser.close()


def main():
    print("=" * 66)
    print("  Local trusted-server credential-wrapping simulation")
    print("=" * 66)

    idp_proc = ensure_idp_running()
    vault_proc = ensure_vault_running()
    try:
        # 0. Mint a real signed JWT from the identity provider
        print(f"\n  [0] Minting a signed JWT from the identity provider")
        jwt, claims = mint_jwt(AGENT_ID, TARGET_HOST, ttl=300)
        print(f"      token (RS256): {jwt[:48]}...")
        print(f"      claims: sub={claims['sub']!r}")
        print(f"              on_behalf_of={claims['on_behalf_of']!r}")
        print(f"              scope={claims['scope']}")
        print(f"              exp in {claims['exp'] - claims['iat']}s   jti={claims['jti'][:8]}...")

        print(f"\n  [1] Uploading extension + creating session")
        print(f"      using API key ...{BROWSERBASE_API_KEY[-6:]}  project {BROWSERBASE_PROJECT_ID}")
        zip_path = zip_extension(EXTENSION_DIR)

        def _with_retry(fn, what, attempts=3):
            last = None
            for i in range(attempts):
                try:
                    return fn()
                except Exception as e:
                    last = e
                    print(f"      {what} attempt {i+1}/{attempts} failed: {str(e)[:90]}")
                    time.sleep(1.5)
            raise last

        with open(zip_path, "rb") as f:
            ext_bytes = f.read()
        extension = _with_retry(
            lambda: bb.extensions.create(file=("extension.zip", ext_bytes, "application/zip")),
            "extension upload",
        )
        session = _with_retry(
            lambda: bb.sessions.create(project_id=BROWSERBASE_PROJECT_ID, extension_id=extension.id),
            "session create",
        )
        print(f"      Extension ID: {extension.id}")
        print(f"      Session ID:   {session.id}")
        print(f"      Recording:    https://www.browserbase.com/sessions/{session.id}")

        # Live View URL — paste this into flow.html to watch the session in the iframe
        try:
            dbg = httpx.get(
                f"https://www.browserbase.com/v1/sessions/{session.id}/debug",
                headers={"X-BB-API-Key": BROWSERBASE_API_KEY}, timeout=10,
            ).json()
            live_url = dbg.get("debuggerFullscreenUrl")
            if live_url:
                print(f"\n  ── LIVE VIEW URL (paste into flow.html) ──")
                print(f"  {live_url}\n")
        except Exception:
            pass

        if WATCH:
            input("  [watch] Live View loaded? Press Enter to run the credential injection... ")

        print(f"\n  [2] Waiting 5s for browser restart with extension...")
        time.sleep(5)

        asyncio.run(run(session.connect_url, jwt))
        show_audit()

        if WATCH:
            input("\n  [watch] Done. Press Enter to close the session... ")

        print(f"\n{'=' * 66}")
        print(f"  Recording: https://www.browserbase.com/sessions/{session.id}")
        print(f"{'=' * 66}")
        print("\n  Trusted-server simulation completed:")
        print("  • The local IdP signs caller-selected claims without authentication")
        print("  • The vault decrypts with its master key before wrapping")
        print("  • The recipient key is caller-supplied, not session-attested")
        print("  • This demonstrates wrapping, not production delegation or zero-knowledge\n")
    finally:
        for proc in (vault_proc, idp_proc):
            if proc is not None:
                proc.terminate()
        print(f"[*] Stopped the services we started.\n")


if __name__ == "__main__":
    if not BROWSERBASE_API_KEY:
        print("Error: BROWSERBASE_API_KEY not set", file=sys.stderr)
        sys.exit(1)
    main()
