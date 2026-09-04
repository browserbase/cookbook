# Venues — Known fingerprints

**When to consult this:** booking at a venue below (skip ahead on URL-path + CC + gotchas), or documenting a new one after a successful end-to-end run.

## What's happening

OpenTable venues differ on three axes that matter for automation: which booking-URL path they use after a time-slot click (`/booking/details` vs `/booking/seating-options` vs `/booking/specials`), whether they require a credit-card hold, and whether they gate the form with per-venue extras (T&Cs checkbox, experience selector, seating-tier picker). Encoding each observed venue's fingerprint means the skill can take a fast path instead of re-discovering behavior per request.

## Heuristic

| Name                      | rid    | metroId | URL path                   | CC required | Notes                                                                                   |
|---------------------------|--------|---------|----------------------------|-------------|-----------------------------------------------------------------------------------------|
| Surisan                   | 298654 | 4       | /booking/details           | no          | Casual Korean, North Beach SF                                                           |
| Lao Table                 | 251962 | 4       | /booking/details           | no          | Thai, SF                                                                                |
| State Bird Provisions     | 139246 | 4       | /booking/seating-options   | yes         | Counter seating variant; `resoAttribute=counter`                                        |
| TAO Downtown - New York   | 112918 | 8       | /booking/specials          | no          | Experience offerings; pick "Standard Reservation" before booking form                   |
| Kokkari Estiatorio        | 1935   | 4       | /booking/details           | no          | Greek, FiDi; **required T&Cs checkbox** (see [`required-tc-checkbox.md`](./required-tc-checkbox.md)); low search rank → use full name (see [`low-ranked-venues.md`](./low-ranked-venues.md)) |
| Cucina Venti              | —      | 4       | (CC-hold — bails at Step 5) | **yes**    | Italian, Mountain View; **tiered-seating label variant** (see [`label-variants.md`](./label-variants.md)); deterministic path emits `credit_card_required` handoff at 70s |

## How `reference.py` handles this deterministically

`reference.py` does not load or index this table at runtime — venue fingerprints are pure diagnostic context for the agent. The deterministic executor discovers the relevant URL variant on each run via the `/booking/<path>` match in Step 5–6 and handles CC detection via the `creditCardRequired=true` query param (see [`url-path-variants.md`](./url-path-variants.md)).

This table is for (a) the agent's Step-4 self-heal reasoning when an unknown venue hits an `unknown_validation_error`, and (b) graduation records — every new row here is a venue that has been driven end-to-end at least once.

## Appending a new venue

After any successful booking at a previously-undocumented venue:

1. Extract `rid` from the `cancel_url` (query param `rid=<n>`).
2. Extract URL path from the `/booking/<path>?...` segment.
3. Read `creditCardRequired=true|false` from the URL query.
4. Add a row here with any venue-specific gotchas encountered.

## Graduation history

- Surisan, Lao Table, State Bird, TAO — from initial autobrowse matrix (see `../../VALIDATION.md`).
- Kokkari Estiatorio — added 2026-04-22 after self-heal cycle surfaced required-T&Cs-checkbox pattern.
- Cucina Venti — added 2026-04-22 during tiered-seating E2E validation. Turned out to be CC-hold (not the non-CC tiered case we were probing for), but validated the `_TIERED_BTN` match → URL-variant detection → CC-hold typed handoff chain works correctly on tiered venues.
