# Post-click booking URL variants

**When to consult this:** after clicking a time-slot button, the post-click URL contains any of `/booking/details`, `/booking/seating-options`, `/booking/specials`, or `creditCardRequired=true`.

## What's happening

Clicking a time slot navigates to one of three booking-flow URL paths. Each path gates a different interstitial before reaching the main Complete-reservation form. All three also carry `creditCardRequired=true|false` in the query string — the authoritative signal for whether the venue requires a card hold.

## Heuristic

### Detect URL path after time-slot click

```
bb browse --connect <sid> get url
```

Match against the path:

| Path                          | When it appears                                                                                 | Extra step before Complete                                                    |
|-------------------------------|-------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------|
| `/booking/details`            | Casual venues, single-tier seating                                                              | None — proceed straight to form submit                                        |
| `/booking/seating-options`    | Venues with multiple seating tiers (counter, dining room, bar) OR credit-card-hold venues       | Snapshot, find a seating-tier `Select` button, click. Then proceed to form.   |
| `/booking/specials`           | Venues offering experience packages (prix-fixe, themed events) alongside standard reservations  | Snapshot, find "Standard Reservation" section, click its `Select` button.     |

### Detect CC hold

```python
if "creditCardRequired=true" in booking_url:
    # Return typed `credit_card_required` handoff + live_view_url
    # Do NOT attempt to synthesize card data
```

CC detection happens **immediately after the time-slot click**, before any form fill or interstitial resolution. Bailing here saves the cost of filling out the form only to fail at submit.

### `experienceIds` on `/booking/specials`

When you land on `/booking/specials`, the URL also contains `experienceIds=<csv>` listing available paid experiences. Ignore these — pick the "Standard Reservation" option to book the free-default.

## How `reference.py` handles this deterministically

In `book_opentable`, Step 5 + Step 6:

- Read `booking_url` via `bb browse get url` after the time-slot click.
- Check `"creditCardRequired=true" in booking_url` → typed `credit_card_required` handoff.
- Check `"/booking/specials" in booking_url` → snapshot, regex-match the "Standard Reservation" Select button under its heading, click.
- Check `"/booking/seating-options" in booking_url` → snapshot, regex-match the first `button: Select\b`, click.
- Fall through to `/booking/details` handling (Complete + T&Cs checkbox per [`required-tc-checkbox.md`](./required-tc-checkbox.md)).

## Graduation history

- All 3 URL variants discovered during initial autobrowse matrix exploration (TAO → `/booking/specials`, State Bird → `/booking/seating-options`, Surisan → `/booking/details`).
- `creditCardRequired=true` as authoritative CC signal confirmed during State Bird validation run 2026-04-21.
- Interstitial flows (seating-options, specials) are URL-validated but not driven end-to-end to a committed reservation (see `../../VALIDATION.md` "Known gaps").
