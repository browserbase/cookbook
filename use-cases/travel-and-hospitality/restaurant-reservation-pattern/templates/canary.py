#!/usr/bin/env python3
"""
canary.py — Drift canary for the reservation portal skill.

Runs a known-good search and asserts (a) ≥1 restaurant returned and
(b) the time-slot label shape still matches the regexes in skill/reference.py.
A failure here means reservation portal's DOM / Akamai / URL structure has drifted
and the skill needs re-graduation via autobrowse.

Deploy via cron; on non-zero exit, page the on-call. Alert routing is left
to the customer — stderr output is structured so cron→PagerDuty / cron→Slack
wrappers can parse it.

Usage:
    BROWSERBASE_API_KEY=... \
    BROWSERBASE_CONTEXT_ID=... \
    python canary.py

Exit codes:
    0 — canary passed (schema matches expected)
    1 — canary failed (drift detected — see stderr)
    2 — infrastructure failure (bb CLI / session / network) — not a drift signal
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Import the skill's workflow primitives so the canary breaks iff the skill
# would also break. If you relocate reference.py, update this import path.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "skill"))
from reference import search_reservation_portal, _SIMPLE_BTN, _TIERED_BTN  # noqa: E402


# Known-good inputs. Italian + SF Bay Area + 14 days out + party 2 is broad
# enough to near-guarantee multiple restaurants return. Adjust per deployment.
def build_expected_query(now: datetime | None = None) -> dict:
    run_time = now or datetime.now().astimezone()
    reservation_time = (run_time + timedelta(days=14)).replace(
        hour=19, minute=0, second=0, microsecond=0
    )
    return {
    "term": "Italian",
    "covers": 2,
    "date_time": reservation_time.isoformat(timespec="minutes"),
    "metro_id": 4,
    }
MIN_RESULTS = 1


def fail(reason: str, detail: dict) -> None:
    payload = {"canary": "reservation_portal.search", "status": "fail", "reason": reason, **detail}
    print(json.dumps(payload), file=sys.stderr)
    sys.exit(1)


def main() -> None:
    expected_query = build_expected_query()
    try:
        result = search_reservation_portal(**expected_query)
    except Exception as e:
        print(json.dumps({"canary": "reservation_portal.search", "status": "infra_error", "error": str(e)}),
              file=sys.stderr)
        sys.exit(2)

    results = result.get("results", [])
    if len(results) < MIN_RESULTS:
        fail("no_results_returned", {"query": expected_query, "results_len": len(results)})

    # Regex-shape sanity: every returned restaurant must have ≥1 parseable time slot.
    # If none of the labels match either _SIMPLE_BTN or _TIERED_BTN, schema drifted.
    for r in results:
        if not r.get("availableTimes"):
            fail("time_slot_parse_empty", {"restaurant": r.get("name"), "results": results})

    print(json.dumps({
        "canary": "reservation_portal.search",
        "status": "pass",
        "query": expected_query,
        "restaurants": len(results),
        "sample": results[0]["name"],
    }))
    sys.exit(0)


if __name__ == "__main__":
    main()
