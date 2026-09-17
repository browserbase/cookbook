#!/usr/bin/env python3
"""
reference.py — Reference Python implementation of the reservation_portal-book-reservation skill.

Wraps the skill's 8-step workflow as two Anthropic-SDK-compatible tools:
  - search_reservation_portal_reservations  (read-only)
  - book_reservation_portal_reservation     (commits a real reservation)

Prerequisites
-------------
  Python 3.10+; the executor uses only the standard library.
  npm install -g @browserbasehq/cli    # the `bb` CLI (wraps `browse` as `bb browse`)

Environment
-----------
  BROWSERBASE_API_KEY       — required
  BROWSERBASE_CONTEXT_ID    — required; pre-authed via the /cookie-sync skill

CLI usage
---------
  python reference.py search '{"term":"Italian","covers":2,"date_time":"<future YYYY-MM-DDTHH:MM>"}'
  python reference.py book   '{"restaurant_name":"Surisan","time_label":"7:30 PM","date_time":"<future YYYY-MM-DDTHH:MM>","party_size":2}'

As an agent tool
----------------
The calling application may install anthropic and configure ANTHROPIC_API_KEY
for its model loop. Neither is required by this executor or its CLI. The snippet
below is a caller integration sketch, not a built-in demo loop.

  import anthropic
  from reference import TOOLS, run_tool
  response = anthropic.Anthropic().messages.create(
      model="claude-sonnet-4-5-20250929",
      tools=TOOLS,
      messages=[{"role": "user", "content": "Book Surisan for 2 Friday at 7:30 PM"}],
  )
  # ... dispatch tool_use blocks through run_tool(name, input)
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import time
from datetime import datetime
from typing import Any
from urllib.parse import urlencode

# ── Session config (matches SKILL.md "Browserbase session config") ──────────

SESSION_CONFIG_TEMPLATE = {
    "browserSettings": {
        "verified": True,
        "solveCaptchas": True,
        "viewport": {"width": 1440, "height": 900},
    },
    "proxies": [
        {
            "type": "browserbase",
            "geolocation": {"city": "San Francisco", "state": "CA", "country": "US"},
        }
    ],
    "keepAlive": True,
    "timeout": 1800,
    "region": "us-west-2",
}

# ── Time-slot label parsers (4 variants documented in SKILL.md Step 4) ──────

_SIMPLE_BTN = re.compile(
    r"\[(\d+-\d+)\] button: (\d{1,2}:\d{2} [AP]M)[* ]*Reserve table at ([^\n]+)"
)
_TIERED_BTN = re.compile(
    r"\[(\d+-\d+)\] button: Select table type for reservation at (.+?) restaurant[^\n]*"
    r"\n\s*\[[^\]]+\] StaticText: (\d{1,2}:\d{2} [AP]M)\*?"
)
_RESTAURANT_SUFFIX = re.compile(r"\s+restaurant\s*$", re.IGNORECASE)

def _clean_name(name: str) -> str:
    return _RESTAURANT_SUFFIX.sub("", name.strip().rstrip(","))

# ── CLI shims (all commands unified under `bb`) ─────────────────────────────

def _run(cmd: list[str], *, input_text: str | None = None, timeout: int = 60) -> dict[str, Any]:
    p = subprocess.run(cmd, input=input_text, capture_output=True, text=True, timeout=timeout)
    if p.returncode != 0:
        raise RuntimeError(f"{cmd[0]} failed: {(p.stderr or p.stdout).strip()}")
    out = p.stdout.strip()
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return {"stdout": out}

def create_session() -> str:
    context_id = os.environ["BROWSERBASE_CONTEXT_ID"]
    body = json.loads(json.dumps(SESSION_CONFIG_TEMPLATE))  # deep copy
    body["browserSettings"]["context"] = {"id": context_id, "persist": True}
    data = _run(["bb", "sessions", "create", "--stdin"], input_text=json.dumps(body), timeout=45)
    return data["id"]

def release_session(session_id: str) -> bool:
    try:
        _run(["bb", "sessions", "update", session_id, "--status", "REQUEST_RELEASE"], timeout=15)
        return True
    except Exception:
        return False

def browse(session_id: str, *args: str) -> dict[str, Any]:
    """Run a `bb browse --connect <id> ...` command and return parsed JSON."""
    return _run(["bb", "browse", "--connect", session_id, *args])

def browse_stop() -> None:
    subprocess.run(["bb", "browse", "stop"], capture_output=True)

def live_view_url(session_id: str) -> str:
    # See /browserbase-cli skill — the live view surface for a given session.
    return f"https://www.browserbase.com/sessions/{session_id}"

# ── Workflow building blocks ────────────────────────────────────────────────

def build_search_url(term: str, covers: int, date_time: str,
                     metro_id: int, region_ids: int | None) -> str:
    qs: dict[str, Any] = {"term": term, "covers": covers, "dateTime": date_time, "metroId": metro_id}
    if region_ids is not None:
        qs["regionIds"] = region_ids
    return "https://reservations.example.invalid/s?" + urlencode(qs)

def warmup(session_id: str) -> None:
    """Step 1+2 — homepage load warms Akamai's bot-manager state on a cold session.

    See references/akamai-warmup.md for the mechanism + recovery posture.
    """
    browse_stop()
    browse(session_id, "open", "https://reservations.example.invalid/")
    browse(session_id, "wait", "load")
    time.sleep(2)

def parse_search_results(tree: str) -> list[dict[str, Any]]:
    """Extract {name, availableTimes[]} from an reservation portal search-page a11y tree."""
    by_rest: dict[str, list[str]] = {}
    for _ref, time_s, name in _SIMPLE_BTN.findall(tree):
        by_rest.setdefault(_clean_name(name), []).append(time_s)
    for _ref, name, time_s in _TIERED_BTN.findall(tree):
        by_rest.setdefault(_clean_name(name), []).append(time_s)
    return [{"name": n, "availableTimes": sorted(set(t))} for n, t in by_rest.items()]

# reservation portal's /s? page loads the shell quickly, then fetches availability via XHR.
# Empirically this takes 8–12s after `wait load` completes; pad for safety.
# (Polling with repeated snapshots is tempting but churns the CDP connection and
# can end the Browserbase session mid-flight — use a fixed sleep instead.)
# See references/hydration-timing.md.
_HYDRATION_WAIT_SEC = 15

def wait_for_hydration(session_id: str, max_seconds: int = _HYDRATION_WAIT_SEC) -> str:
    """Fixed-sleep for hydration, then snapshot once. Returns the a11y tree."""
    time.sleep(max_seconds)
    snap = browse(session_id, "snapshot")
    return snap.get("tree", "") if isinstance(snap, dict) else ""

def find_slot_ref(tree: str, restaurant: str, time_label: str) -> str | None:
    """Find the clickable ref for <restaurant>+<time>, across the 4 label variants.

    Variants documented in references/label-variants.md. If no match but the
    caller is certain the venue has availability, see references/low-ranked-venues.md
    for the full-name / pinnedRid workarounds.
    """
    restaurant_key = " ".join(restaurant.casefold().split())
    for m in _SIMPLE_BTN.finditer(tree):
        ref, time_s, name = m.groups()
        if time_s == time_label and restaurant_key == " ".join(_clean_name(name).casefold().split()):
            return ref
    for m in _TIERED_BTN.finditer(tree):
        ref, name, time_s = m.groups()
        if time_s == time_label and restaurant_key == " ".join(_clean_name(name).casefold().split()):
            return ref
    return None

# ── Public tool handlers ────────────────────────────────────────────────────

def search_reservation_portal(*, term: str, covers: int, date_time: str,
                     metro_id: int = 4, region_ids: int | None = None) -> dict[str, Any]:
    sid = create_session()
    try:
        warmup(sid)
        browse(sid, "open", build_search_url(term, covers, date_time, metro_id, region_ids))
        browse(sid, "wait", "load")
        tree = wait_for_hydration(sid, max_seconds=20)
        return {"results": parse_search_results(tree)}
    finally:
        browse_stop()
        release_session(sid)

def _handoff(sid: str, reason: str, detail: str) -> dict[str, Any]:
    return {
        "success": False,
        "confirmation_number": None,
        "restaurant_name": None,
        "reservation_datetime": None,
        "party_size": None,
        "cancel_url": None,
        "live_view_url": live_view_url(sid),
        "handoff_session_id": sid,
        "expires_in_seconds": SESSION_CONFIG_TEMPLATE["timeout"],
        "reason": reason,
        "error_reasoning": detail,
    }

def book_reservation_portal(*, restaurant_name: str, time_label: str, date_time: str, party_size: int,
                   metro_id: int = 4, region_ids: int | None = None) -> dict[str, Any]:
    sid = create_session()
    handoff_transferred = False
    def handoff(reason: str, detail: str) -> dict[str, Any]:
        nonlocal handoff_transferred
        handoff_transferred = True
        return _handoff(sid, reason, detail)
    try:
        # Steps 1–2: warmup
        warmup(sid)

        # Step 3: direct search + wait for availability XHR to hydrate
        search_url = build_search_url(restaurant_name, party_size, date_time, metro_id, region_ids)
        browse(sid, "open", search_url)
        browse(sid, "wait", "load")
        wait_for_hydration(sid, max_seconds=20)  # discard returned tree — we re-snapshot at Step 4

        url = browse(sid, "get", "url").get("url", "")
        if "/account/signin" in url:
            return handoff("auth_required", "Context expired; re-run /cookie-sync.")

        title = browse(sid, "get", "title").get("title", "")
        if title == "Access Denied":
            # One warmup-retry per SKILL.md Step 3 guidance
            browse(sid, "open", "https://reservations.example.invalid/"); browse(sid, "wait", "load"); time.sleep(3)
            browse(sid, "open", search_url); browse(sid, "wait", "load"); time.sleep(5)
            if browse(sid, "get", "title").get("title", "") == "Access Denied":
                return handoff("captcha_or_blocked", "Akamai edge block persists after warmup+retry.")

        # Step 4: find + click time slot
        tree = browse(sid, "snapshot").get("tree", "")
        ref = find_slot_ref(tree, restaurant_name, time_label)
        if not ref:
            return handoff("no_availability",
                            f"No {time_label} slot visible on {restaurant_name!r}'s card.")
        browse(sid, "click", ref); browse(sid, "wait", "load"); time.sleep(3)

        # Step 5: CC check + URL-variant detection
        # See references/url-path-variants.md for the 3 booking URL paths + creditCardRequired signal.
        booking_url = browse(sid, "get", "url").get("url", "")
        if "creditCardRequired=true" in booking_url:
            return handoff("credit_card_required",
                            "Venue requires a credit-card hold; ask the end user to enter details via the live view.")

        # Step 6: resolve interstitials (if /booking/specials or /booking/seating-options)
        if "/booking/specials" in booking_url:
            tree = browse(sid, "snapshot").get("tree", "")
            m = re.search(
                r"heading: Standard Reservation[^\[]*\[(?:\d+-\d+)\][^\[]*"
                r"\[(\d+-\d+)\] button: Select",
                tree, re.DOTALL,
            )
            if not m:
                return handoff("unknown_validation_error",
                                "Could not locate 'Standard Reservation' Select button on /booking/specials page.")
            browse(sid, "click", m.group(1)); browse(sid, "wait", "load"); time.sleep(3)
        elif "/booking/seating-options" in booking_url:
            tree = browse(sid, "snapshot").get("tree", "")
            m = re.search(r"\[(\d+-\d+)\] button: Select\b", tree)
            if not m:
                return handoff("unknown_validation_error",
                                "Could not locate a seating-option Select button on /booking/seating-options page.")
            browse(sid, "click", m.group(1)); browse(sid, "wait", "load"); time.sleep(3)

        # Step 6 cont'd: Handle per-venue required T&Cs checkbox (if present), then Complete
        # See references/required-tc-checkbox.md.
        tree = browse(sid, "snapshot").get("tree", "")

        # Some venues (e.g. Kokkari Estiatorio — deposit / cancellation policy venues)
        # gate submission behind a "Required:" terms-and-conditions checkbox on
        # /booking/details. Complete silently no-ops until ticked, producing an
        # unknown_validation_error because the URL never flips to /booking/confirmation.
        tc_match = re.search(
            r"heading: Required:[^\[]*\[[^\]]+\][^\[]*\[(\d+-\d+)\] checkbox: I agree",
            tree, re.DOTALL,
        )
        if tc_match:
            browse(sid, "click", tc_match.group(1)); time.sleep(1)
            tree = browse(sid, "snapshot").get("tree", "")  # refresh for Complete ref

        m = re.search(r"\[(\d+-\d+)\] button: Complete reservation", tree)
        if not m:
            return handoff("unknown_validation_error",
                            "Booking form did not expose a 'Complete reservation' button.")
        browse(sid, "click", m.group(1)); browse(sid, "wait", "load"); time.sleep(4)

        # Step 7: read confirmation from the URL
        final_url = browse(sid, "get", "url").get("url", "")
        conf = re.search(r"confirmationNumber=(\d+)", final_url)
        if not conf:
            # Check for phone-format alert
            tree = browse(sid, "snapshot").get("tree", "")
            if re.search(r"phone\s*number\s*format\s*is\s*invalid", tree, re.IGNORECASE):
                return handoff("phone_format_rejected",
                                "reservation portal rejected the phone number format. Retry without a custom phone.")
            return handoff("unknown_validation_error",
                            f"No confirmationNumber in final URL: {final_url[:160]}")

        confirmation_tree = browse(sid, "snapshot").get("tree", "")
        if not confirmation_matches(confirmation_tree, restaurant_name, time_label, date_time, party_size):
            return handoff("confirmation_unverified",
                           "Confirmation number was present, but venue/date/time/party evidence did not match.")

        # Step 8: emit verified success and stop (no further clicks, per skill idempotency rule)
        return {
            "success": True,
            "confirmation_number": conf.group(1),
            "restaurant_name": restaurant_name,
            "reservation_datetime": date_time,
            "party_size": party_size,
            "cancel_url": final_url,
            "error_reasoning": None,
        }
    finally:
        browse_stop()
        if not handoff_transferred:
            release_session(sid)

def confirmation_matches(tree: str, restaurant: str, time_label: str,
                         date_time: str, party_size: int) -> bool:
    text = " ".join(tree.casefold().split())
    restaurant_key = " ".join(restaurant.casefold().split())
    labels = [" ".join(match.casefold().split()) for match in
              re.findall(r"(?:heading|statictext|link):\s*([^\n]+)", tree, re.IGNORECASE)]
    venue_ok = restaurant_key in labels
    time_ok = time_label.casefold() in text
    try:
        date = datetime.fromisoformat(date_time).date()
        date_forms = {date.isoformat(), date.strftime("%B %-d, %Y").casefold(), date.strftime("%b %-d, %Y").casefold()}
    except ValueError:
        return False
    date_ok = any(form in text for form in date_forms)
    party_ok = any(value in text for value in (f"party of {party_size}", f"{party_size} people", f"{party_size} guests"))
    return venue_ok and time_ok and date_ok and party_ok

def release_reservation_portal_handoff(*, session_id: str) -> dict[str, Any]:
    if not re.fullmatch(r"[A-Za-z0-9_-]{8,128}", session_id):
        raise ValueError("invalid handoff session ID")
    browse_stop()
    requested = release_session(session_id)
    return {"release_requested": requested, "session_id": session_id}

# ── Anthropic tool definitions ──────────────────────────────────────────────

TOOLS = [
    {
        "name": "search_reservation_portal_reservations",
        "description": (
            "Search reservation portal for available restaurants matching a term + date/time + party size in a given metro. "
            "Returns up to 10 restaurants with their available time slots. "
            "metroId 4 = San Francisco Bay Area, metroId 8 = New York City."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "term": {"type": "string", "description": "Restaurant name or cuisine"},
                "covers": {"type": "integer"},
                "date_time": {"type": "string", "description": "Local time 'YYYY-MM-DDTHH:MM'"},
                "metro_id": {"type": "integer", "default": 4},
                "region_ids": {"type": "integer"},
            },
            "required": ["term", "covers", "date_time"],
        },
    },
    {
        "name": "book_reservation_portal_reservation",
        "description": (
            "Book a specific reservation portal reservation. Commits a real reservation under the pre-authed account. "
            "The caller MUST explicitly confirm restaurant + date + time + party with the end user before invoking. "
            "Returns a handoff (with live-view URL) if the venue requires a credit-card hold, the context has expired, "
            "Akamai blocks the session, or no matching time slot is available."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "restaurant_name": {"type": "string"},
                "time_label": {"type": "string", "description": "e.g. '7:30 PM' — must match a visible slot on the restaurant's card"},
                "date_time": {"type": "string", "description": "Local time 'YYYY-MM-DDTHH:MM'"},
                "party_size": {"type": "integer"},
                "metro_id": {"type": "integer", "default": 4},
                "region_ids": {"type": "integer"},
            },
            "required": ["restaurant_name", "time_label", "date_time", "party_size"],
        },
    },
    {
        "name": "release_reservation_portal_handoff",
        "description": "Release a Browserbase session returned by an reservation portal handoff after the human finishes or abandons it.",
        "input_schema": {
            "type": "object",
            "properties": {"session_id": {"type": "string"}},
            "required": ["session_id"],
        },
    },
]

def run_tool(name: str, tool_input: dict[str, Any]) -> dict[str, Any]:
    if name == "search_reservation_portal_reservations":
        return search_reservation_portal(**tool_input)
    if name == "book_reservation_portal_reservation":
        return book_reservation_portal(**tool_input)
    if name == "release_reservation_portal_handoff":
        return release_reservation_portal_handoff(**tool_input)
    raise ValueError(f"unknown tool: {name}")

# ── CLI entrypoint ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0)

    cmd = sys.argv[1]
    kwargs = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    if cmd == "search":
        print(json.dumps(search_reservation_portal(**kwargs), indent=2))
    elif cmd == "book":
        print(json.dumps(book_reservation_portal(**kwargs), indent=2))
    else:
        print(f"Unknown command {cmd!r}. Use 'search' or 'book'.", file=sys.stderr)
        sys.exit(1)
