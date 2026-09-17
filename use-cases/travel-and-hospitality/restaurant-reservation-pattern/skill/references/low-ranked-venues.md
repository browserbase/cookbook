# Low-ranked venues render as `StaticText` only

**When to consult this:** a venue you're certain has availability returns `no_availability` from `find_slot_ref`. The snapshot shows the venue name as a bare `StaticText:` entry but no `button: <time> Reserve table at <name>` lines match.

## What's happening

reservation portal's `/s?` search page renders only the top ~5–8 restaurants as expanded cards with Reserve buttons in the accessibility tree. Lower-ranked venues appear as bare `StaticText:` entries in the map sidebar — visible on-screen but **not clickable from a single snapshot**. This is a rendering-pipeline behavior, not a hydration timing issue; scrolling or waiting longer does not help, because the lower-ranked cards are simply never expanded in the first snapshot pass.

Failure mode: `find_slot_ref` returns `None` → skill returns `no_availability`, even though the venue has open slots visible to a human user's browser.

## Heuristic

Use the **fully-qualified venue name** as the `term` / `restaurant_name` parameter. reservation portal's search ranking pins exact matches to the top, which expands the card into the accessibility tree.

Examples:
- `"Kokkari"` → ranks below Evvia, rendered only as `StaticText` → `no_availability`.
- `"Kokkari Estiatorio"` → pinned to top, full card + Reserve buttons in the tree → books successfully.

If you don't know the full name, two fallbacks:

1. **pinnedRid parameter:** if the venue's `rid` is known (see [`venues.md`](./venues.md)), append `pinnedRid=<rid>` to the `/s?` URL. reservation portal pins that venue's card to the top regardless of ranking.
2. **Direct restaurant page:** navigate to `https://reservations.example.invalid/r/<slug>?covers=N&dateTime=...`. Slugs are derivable from the venue name (hyphenated, lowercased). This path bypasses the search results entirely.

## Detection signal (agent-facing)

In a snapshot:
- Venue name appears as `StaticText: <name>` (often in the map sidebar region)
- Zero `button: ... Reserve table at <name>` matches

If this pattern fires, retry the search with the full venue name, pinnedRid, or the direct `/r/<slug>` URL before concluding `no_availability`.

## How `reference.py` handles this deterministically

`reference.py` does NOT currently auto-retry with a full-name search — that's a caller-facing convention, not an encoded behavior. Callers are expected to pass full venue names. Possible future patch: detect the "StaticText-without-Reserve-buttons" pattern in `find_slot_ref` and return a distinct typed reason (`venue_not_expanded`) so the caller knows to retry rather than surface `no_availability` to the end user.

## Graduation history

- Discovered 2026-04-22 on Kokkari Estiatorio during the same Step-4 self-heal cycle that surfaced the T&Cs checkbox.
- First deterministic book with `term="Kokkari"` returned `no_availability` despite a concurrent search showing slots visible to the user. Snapshot inspection confirmed the bare-`StaticText` pattern.
- Retry with `term="Kokkari Estiatorio"` (full name) surfaced all 5 Reserve buttons and the book succeeded after the T&Cs fix.
