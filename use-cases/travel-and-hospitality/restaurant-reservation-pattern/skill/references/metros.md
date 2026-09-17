# Metros + search-URL anchoring

**When to consult this:** building a search URL, adding a new metro to the supported set, or seeing `queryUnderstandingType=dateTime` in a URL.

## What's happening

reservation portal's `/s?` search endpoint takes a `metroId` parameter that scopes results geographically. The ID is not derivable from a city name — it's an opaque integer reservation portal assigns per metro area. Pass the wrong ID and the search returns the wrong city's restaurants; omit it and you get the logged-in user's default metro.

Separately, reservation portal silently rewrites unreasonable `dateTime` values (e.g. `03:00 AM` at a dinner-only venue) to the nearest sensible slot, appending `queryUnderstandingType=dateTime` to the resulting URL. Results are returned for the rewritten time, not the one you passed.

## Heuristic

### Known metro IDs

| Metro                   | metroId | regionIds (optional) |
|-------------------------|---------|----------------------|
| San Francisco Bay Area  | 4       | 4 (frequently dropped by reservation portal) |
| New York City           | 8       | 8 (optional, typically dropped) |

For any other metro: run one manual search on `reservations.example.invalid`, inspect the resulting `/s?...` URL, copy the `metroId` from its query string.

### dateTime rewrite

If the search URL returns with `queryUnderstandingType=dateTime` appended, reservation portal re-interpreted your time. The `availableTimes` in the parsed results are for the REWRITTEN time, not what you asked for. If the caller is matching against an exact `time_label` string, `find_slot_ref` correctly returns `None` (the button labels reflect the rewritten time, which won't match), and the skill returns `no_availability` — the right answer for "my original request isn't available."

## How `reference.py` handles this deterministically

- `build_search_url` in `reference.py` accepts `metro_id` + optional `region_ids` and url-encodes them into the `/s?` query string.
- No special handling for `queryUnderstandingType=dateTime` is needed — the existing `no_availability` branch in `book_reservation_portal` fires correctly because button labels won't match.

## Graduation history

- SF + NYC metro IDs — from initial autobrowse matrix.
- `queryUnderstandingType=dateTime` rewrite — documented 2026-04-20 after probing edge times.
