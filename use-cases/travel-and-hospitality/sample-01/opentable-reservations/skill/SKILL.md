---
name: opentable-book-reservation
description: Book an OpenTable reservation end-to-end via the `bb` CLI — production runs against Browserbase (stealth + residential proxy + authed context), development attaches to a local debug Chrome. Returns the confirmation number and a cancel URL as JSON. Requires a pre-authed OpenTable context (see /cookie-sync) and the `bb` CLI (see /browserbase-cli).
---

# OpenTable — Book Reservation (Browser Skill)

Book a reservation on opentable.com for a given restaurant, date, time, and party size. Returns the confirmation number and a cancel URL as JSON. Works on either Browserbase (recommended for production) or a local debug Chrome (for development).

**Companion files in this directory:**
- `references/` — progressive-disclosure knowledge store. One file per heuristic (venues, Akamai warmup, hydration timing, label variants, URL-path variants, required T&Cs checkbox, low-ranked venues, metros). Consult via the "When you see… consult…" table at the end of this file — **don't read all references up front**. Append new findings by adding a file + a row to that table.
- `reference.py` — Python execution layer wrapping this workflow as two Anthropic-SDK-compatible tools (`search_opentable_reservations`, `book_opentable_reservation`). All subprocess calls unified under `bb`. Each encoded heuristic cites its `references/*.md` source.
- `fallback_sketch.py` — illustrative self-heal pattern for when this deterministic path hits a typed failure (see `../LOOP.md` § "Step 4: Self-heal"). Not validated end-to-end.
- `notes.md` — DEPRECATED stub. Prior cumulative-memory dump has been decomposed into `references/`.

## When to Use

An agent needs to reserve a table on OpenTable on behalf of its end user. The caller has:

- A Browserbase project, or a local Chrome launched with remote debugging, **and**
- A pre-authed OpenTable session seeded into a persistent Browserbase context via the `/cookie-sync` skill.

Do **not** use this skill speculatively — each run commits a real reservation and the account is liable for no-shows. Confirm restaurant + date + time + party with the end user before invoking.

## Prerequisites

### Authenticated Browserbase context (one-time, required for production)

Bookings run under whichever account is authed in the context you pass. Seed a context once per account:

1. Launch a debug Chrome: `/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/RemoteDebugProfile`
2. Log into opentable.com in that Chrome.
3. Run `/cookie-sync --domains opentable.com --stealth --proxy "San Francisco,CA,US"` — returns a context ID.
4. Persist the returned ID as `BROWSERBASE_CONTEXT_ID` in your agent's environment.

### CLI

- `bb` CLI: `npm install -g @browserbasehq/cli`. The `bb browse ...` subcommand is a 1:1 passthrough to the standalone `browse` CLI, so you only need one binary. See `/browserbase-cli` skill for session/context management.

### Environment

- Production: `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, `BROWSERBASE_CONTEXT_ID`
- Development: local Chrome 136+ running on CDP port 9222 with the target account logged in. Verify: `curl -s http://127.0.0.1:9222/json/version` returns JSON.

## Workflow

Turn budget: 15 turns. Follow in order. Only deviate if a step fails.

### Step 1 — Attach session

**Production (Browserbase).** Create a session with the config in [Browserbase session config](#browserbase-session-config) below, then:
```
bb browse stop
bb browse --connect <session-id> open https://www.opentable.com/
```

**Development (local Chrome).**
```
bb browse stop
bb browse env local 9222
bb browse open https://www.opentable.com/
```

### Step 2 — Warm up the session (required on Browserbase)

```
bb browse wait load
bb browse get url
```

Direct navigation to `/s?...` on a *cold* Browserbase session can return `Access Denied` from Akamai's edge. Loading `/` first lets Akamai's bot-management script evaluate the browser; subsequent navigation on the same session then passes. On local Chrome this step is a no-op / auth check.

If `get url` shows `/account/signin`, abort with `auth_required` — the context expired.

### Step 3 — Navigate to the direct-search URL

URL-encode spaces as `+` in `term` and `:` as `%3A` in `dateTime`:
```
bb browse open "https://www.opentable.com/s?term=<NAME>&covers=<N>&dateTime=<YYYY-MM-DD>T<HH>%3A<MM>&metroId=<ID>&regionIds=<ID>"
bb browse wait load
```

- `metroId=4` (SF Bay Area) and `metroId=8` (New York City) are verified. For other metros, run a one-time manual search on the homepage and copy the ID from the resulting URL.
- `regionIds` is **optional** — OpenTable drops it without affecting results. Include when you have it (paired with `metroId`) or omit entirely.
- `dateTime` is local time, 24-hour, no seconds, no timezone. If you pass an unreasonable time (e.g. `03:00` at a restaurant), OpenTable silently rewrites it to the nearest sensible slot (`queryUnderstandingType=dateTime` appears in the resulting URL). Venues closed at the rewritten time render zero time-slot buttons — the `no_availability` match in Step 4 still fires correctly because no button matches the originally-requested label.

If this returns `Access Denied` (check `bb browse get title` for `"Access Denied"`): reload `/`, wait 2–3s, retry `/s?` once. If still blocked, abort with `captcha_or_blocked`.

### Step 4 — Click the time slot

```
bb browse snapshot
```

Match buttons by label pattern — refs drift across sessions. Four label variants exist in the wild:

| Variant | Label pattern | How to get the time |
|---|---|---|
| Simple | `button: <time> Reserve table at <name> restaurant` | From the label itself |
| Simple + points | `button: <time> Reserve table at <name> restaurant and redeem +<N> pts` | From the label itself |
| Tiered | `button: Select table type for reservation at <name> restaurant` | From a child `StaticText: <time>` |
| Tiered + points | `button: Select table type for reservation at <name> restaurant and redeem +<N> pts` | From a child `StaticText: <time>` |

Where `<time>` is `H:MM AM` or `H:MM PM`, optionally suffixed with `*` (asterisk marks special terms — often a CC hold or cancellation fee; treat as an advisory, not as a CC-required boolean).

**Robust matcher:** find every button whose label contains `"Reserve table at <restaurant>"` OR `"Select table type for reservation at <restaurant> restaurant"`. For each, extract the time either from the label itself or from the nearest child StaticText matching `\d{1,2}:\d{2} [AP]M\*?`. Match against the caller's requested time. Click the matching ref:
```
bb browse click <ref>
bb browse wait load
```

If no matching label is found after exhausting both variants, abort with `no_availability`.

### Step 5 — Check for credit-card requirement and handle interstitials

```
bb browse get url
```

The resulting URL tells you which booking flow this venue uses. All three variants carry `creditCardRequired=true|false` in the query string:

| URL path | When it appears | Extra step |
|---|---|---|
| `/booking/details` | Casual venues, single-tier seating | None — proceed straight to Step 6 |
| `/booking/seating-options` | Venues with multiple seating tiers (counter vs dining room) and often CC holds | Pick a seating tier (Step 6 does this) |
| `/booking/specials` | Venues with experience/prix-fixe packages | Click the "Standard Reservation" option (Step 6 does this) |

If the URL shows `creditCardRequired=true`, return `{success: false, reason: "credit_card_required", live_view_url}` — the end user must enter card details themselves via the live view. Never attempt to synthesize card data.

### Step 6 — Resolve interstitial (if any) and submit

If the current URL is `/booking/seating-options`: snapshot, find a seating-tier button that matches the caller's preference (or the default/cheapest option if unspecified), click it. The flow then lands on the booking form.

If the current URL is `/booking/specials`: snapshot, find `button: Select` under the article headed `Standard Reservation` (not the paid packages), click it. The flow lands on the booking form.

If the current URL is `/booking/details`: you're already on the booking form.

On the booking form, the diner fields are pre-filled from the authed account (name, phone, email). Do **not** overwrite the phone unless the caller explicitly passes a replacement — the account default is known-valid; fake numbers like `555-xxx-xxxx` fail OpenTable's format check.

```
bb browse snapshot
# match "button: Complete reservation"
bb browse click <ref>
bb browse wait load
```

### Step 7 — Read the confirmation

```
bb browse get url
```

On success the URL matches:
```
https://www.opentable.com/booking/confirmation?...&confirmationNumber=<digits>&securityToken=<token>&...
```

Parse `confirmationNumber`. Use the full URL as `cancel_url`.

### Step 8 — Emit JSON and stop

**Do not click, reload, or re-submit anything** after seeing the confirmation URL. The reservation is committed; any extra action risks a duplicate or a modify. Emit the final JSON and return.

## Browserbase session config

Paste into `bb sessions create --stdin`:
```json
{
  "browserSettings": {
    "advancedStealth": true,
    "context": { "id": "<BROWSERBASE_CONTEXT_ID>", "persist": true },
    "solveCaptchas": true,
    "viewport": { "width": 1440, "height": 900 }
  },
  "proxies": [
    {
      "type": "browserbase",
      "geolocation": { "city": "San Francisco", "state": "CA", "country": "US" }
    }
  ],
  "keepAlive": true,
  "timeout": 1800,
  "region": "us-west-2"
}
```

Returns a session JSON with an `id` — pass that to `bb browse --connect <id>`.

## Site-Specific Gotchas

1. **Cold Browserbase sessions and Akamai.** Direct navigation to `/s?...` on a fresh session can return an edge-level 403 (reference pattern `18.<hash>` on `errors.edgesuite.net`). Mitigation: always `page.goto("/") → wait → page.goto("/s?...")` on the same session. Verified working on `us-west-2` with `advancedStealth` + residential proxy geolocated to San Francisco.

2. **Phone-format validation.** `555-xxx-xxxx` (reserved) is rejected. Pass bare 10 digits or use the account's pre-populated phone.

2a. **Time-label asterisks** (`7:30 PM*`). An asterisk suffix on a time label marks special terms — typically a credit-card hold, a cancellation fee, or a prix-fixe requirement. Treat it as an advisory to surface to the user, not as a CC-required boolean (that signal lives in the `creditCardRequired` query param after clicking).

2b. **Verified metro IDs.** `metroId=4` (SF Bay Area), `metroId=8` (New York City). For others, derive by running a one-time manual search on `opentable.com` and reading the value from the resulting URL. `regionIds` is optional — OpenTable drops it without affecting results.

2c. **Booking-flow URL variants.** Step 5 lists the three `/booking/*` paths you may land on after clicking a time slot. All three carry `creditCardRequired=true|false` in the query string; only `/booking/details` goes directly to the form — the other two need one interstitial click (Step 6).

2d. **DateTime query rewrites.** Passing an unreasonable time (e.g. `03:00` at most venues) triggers OpenTable's `queryUnderstandingType=dateTime` rewrite, which silently substitutes the nearest sensible slot. The skill's `no_availability` match still fires correctly because no button matches the originally-requested time.

3. **Time-slot refs are not stable.** They change between sessions and between snapshots. Match by label pattern, not ref ID.

4. **Confirmation detection via URL, not snapshot.** The confirmation page often has very few a11y refs because content renders late. `bb browse get url` is the reliable signal; look for `/booking/confirmation?` and `confirmationNumber=`.

5. **Account scope.** The booking runs under whichever account is authed in the Browserbase context you pass. The caller picks the account — this skill does not switch accounts.

6. **Idempotency.** Once the confirmation URL appears, the reservation is committed. Duplicate clicks on Complete may create a second reservation (Surisan-style venues have multiple tables per slot) or fail opaquely. Enforce stop-on-first-confirmation in the caller.

## Failure Recovery

- **`auth_required`** — URL redirected to `/account/signin`. Context expired; re-run `/cookie-sync` and update `BROWSERBASE_CONTEXT_ID`.
- **`captcha_or_blocked`** — title `"Access Denied"` after warmup + one retry. Session IP reputation is bad; release and create a new session, optionally in a different region (`us-east-1`, `eu-central-1`).
- **`no_availability`** — no time-slot button matches. Offer the user nearby times from the same card.
- **`credit_card_required`** — `creditCardRequired=true` in the booking URL. Return the Browserbase live-view URL; user enters card details, agent can re-invoke or resume.
- **`phone_format_rejected`** — inline alert after submit. Retry once with the account's pre-populated phone (clear field and re-submit; form re-fills from account).
- **Unexpected validation alert** — snapshot, extract alert text, return it in `error_reasoning`.

## When you see… consult

Signal-to-reference lookup for Step-4 self-heal diagnosis. Consult the referenced file on demand — don't preload the `references/` directory.

| Signal / observation | Consult |
|---|---|
| `title: Access Denied` after nav to `/s?...` | [`references/akamai-warmup.md`](./references/akamai-warmup.md) |
| Empty snapshot after `wait load` completes | [`references/hydration-timing.md`](./references/hydration-timing.md) |
| `button: Select table type for reservation at…` | [`references/label-variants.md`](./references/label-variants.md) (tiered variant) |
| Venue name visible only as `StaticText` (no Reserve buttons match) | [`references/low-ranked-venues.md`](./references/low-ranked-venues.md) |
| Post-click URL is `/booking/seating-options` | [`references/url-path-variants.md`](./references/url-path-variants.md) |
| Post-click URL is `/booking/specials` | [`references/url-path-variants.md`](./references/url-path-variants.md) |
| `creditCardRequired=true` in booking URL | [`references/url-path-variants.md`](./references/url-path-variants.md) |
| `heading: Required:` + `checkbox: I agree` on `/booking/details` | [`references/required-tc-checkbox.md`](./references/required-tc-checkbox.md) |
| `queryUnderstandingType=dateTime` in URL (silent time rewrite) | [`references/metros.md`](./references/metros.md) |
| Booking at a known venue (fingerprint) / documenting a new one | [`references/venues.md`](./references/venues.md) |
| Building a search URL for a new metro | [`references/metros.md`](./references/metros.md) |

Full index: [`references/README.md`](./references/README.md).

## Invoking from an agent

Wrap the Workflow above as a tool on your agent. Shape (Anthropic SDK, tool-use):

```python
from reference import TOOLS, run_tool

# TOOLS is the canonical schema used by run_tool. Its booking definition
# requires restaurant_name, time_label, date_time, and party_size. Pass the
# visible slot label (for example, "7:30 PM") as time_label.
```

The handler shells out to `bb` (sessions + browse) following Steps 1–8 above. Use the same shape in Node via `@anthropic-ai/sdk`'s `Anthropic.Tool` type.

A companion `search_opentable_reservations` tool can wrap Steps 1–3 plus a `bb browse snapshot` + local parse of time-slot labels — no separate workflow needed.

## Expected Output

Success:
```json
{
  "success": true,
  "confirmation_number": "XXXXX",
  "restaurant_name": "Restaurant Name",
  "reservation_datetime": "2026-05-08T19:30:00-07:00",
  "party_size": 2,
  "cancel_url": "https://www.opentable.com/booking/confirmation?confirmationNumber=XXXXX&securityToken=YYYYY&...",
  "error_reasoning": null
}
```

`cancel_url` carries the `availabilityToken`, `securityToken`, and `confirmationNumber` — opening it in a browser exposes OpenTable's Modify / Cancel controls.

Failure:
```json
{
  "success": false,
  "confirmation_number": null,
  "restaurant_name": null,
  "reservation_datetime": null,
  "party_size": null,
  "cancel_url": null,
  "error_reasoning": "<one of: captcha_or_blocked | no_availability | auth_required | credit_card_required | phone_format_rejected | unknown_validation_error — plus a short note>"
}
```
