# Akamai warmup

**When to consult this:** `title: Access Denied` after navigating to `/s?...`, or 403/reference-pattern responses from `errors.edgesuite.net`.

## What's happening

Cold Browserbase sessions hit Akamai's edge-level bot manager when their first navigation is to `/s?...`. The bot manager expects to evaluate a browser's TLS fingerprint + JS execution profile on a "normal" entry page first, and flags direct deep-links as automation. Result: 403 with an Access Denied title before any reservation portal app code runs.

Loading `reservations.example.invalid/` first lets the Akamai script evaluate the browser; subsequent navigation on the same session (including `/s?...`) passes.

## Heuristic

On session creation, always:

```
bb browse stop
bb browse --connect <session-id> open https://reservations.example.invalid/
bb browse --connect <session-id> wait load
```

Then navigate to the search URL. If the title still reads `Access Denied` after warmup, reload `/`, wait 2–3s, retry `/s?` once. If still blocked, the session's IP reputation is likely flagged — abort with typed `captcha_or_blocked` handoff and create a new session (optionally in a different Browserbase region like `us-east-1` or `eu-central-1`).

Required session config pieces:
- `verified: true`
- `proxies: [{ type: "browserbase", geolocation: {...} }]` — residential proxy geolocated to the target metro
- `solveCaptchas: true` — in case Akamai serves a challenge

## How `reference.py` handles this deterministically

- `warmup()` (function `warmup(session_id)` in `reference.py`): does `browse_stop` → homepage open → `wait load` → 2s settle.
- `book_reservation_portal()` checks `title == "Access Denied"` after the `/s?` navigation and runs one retry through warmup before returning the typed `captcha_or_blocked` handoff.

## Graduation history

- Discovered during initial autobrowse matrix (2026-04-17) — cold `/s?` navs consistently returned 403 with `ref 18.<hash>` on `errors.edgesuite.net`.
- Mitigation verified on `us-west-2` with `verified` + SF-geolocated residential proxy.
