# Required per-venue T&Cs checkbox on `/booking/details`

**When to consult this:** on `/booking/details`, the snapshot shows a `heading: Required:` block with a child `checkbox: I agree to the restaurant's terms and conditions`. Or: Complete-reservation click silently no-ops (URL stays on `/booking/details`, never advances to `/booking/confirmation`) → `unknown_validation_error`.

## What's happening

Some venues gate the Complete-reservation submission behind a per-venue terms-and-conditions checkbox on the booking form. Typical trigger: venues with deposit policies, strict cancellation rules, or large-party minimums. The checkbox appears even when the current party size doesn't trigger the underlying policy (e.g. Kokkari Estiatorio charges $25/person deposit for parties of 5+, but renders the checkbox for party-of-2 bookings as well).

If the checkbox isn't ticked, OpenTable's client-side form validation silently rejects the submit. The URL never flips to `/booking/confirmation`, so the deterministic path times out its confirmation-number check and returns `unknown_validation_error`.

Do NOT confuse with the "OpenTable Regulars" points opt-in checkbox on the same page — that one is optional and does not gate submission. The **"Required:" heading is the discriminator.**

## Heuristic

On `/booking/details`, after any seating-options or specials interstitial is resolved and before clicking Complete:

1. Snapshot.
2. Regex-match: `heading: Required:[^\[]*\[[^\]]+\][^\[]*\[(\d+-\d+)\] checkbox: I agree`.
3. If matched, click the captured checkbox ref, sleep 1s.
4. Re-snapshot (the Complete-reservation button's ref may have rotated after the checkbox DOM change).
5. Click the fresh Complete ref.

## How `reference.py` handles this deterministically

In `book_opentable`, Step 6:

```python
# Handle per-venue required T&Cs checkbox (if present), then Complete
tree = browse(sid, "snapshot").get("tree", "")
tc_match = re.search(
    r"heading: Required:[^\[]*\[[^\]]+\][^\[]*\[(\d+-\d+)\] checkbox: I agree",
    tree, re.DOTALL,
)
if tc_match:
    browse(sid, "click", tc_match.group(1)); time.sleep(1)
    tree = browse(sid, "snapshot").get("tree", "")  # refresh for Complete ref

m = re.search(r"\[(\d+-\d+)\] button: Complete reservation", tree)
...
```

No-op if the checkbox isn't present. Venues without T&Cs gates are unaffected.

## Graduation history

- Discovered 2026-04-22 on Kokkari Estiatorio during a Step-4 self-heal cycle.
- Three consecutive `unknown_validation_error` handoffs from `reference.py` led to snapshot inspection of `/booking/details`, surfacing the `heading: Required:` block.
- Deterministic patch shipped same day; subsequent booking (#2111422429) at Kokkari 5:15 PM confirmed the encoded path works one-shot, 87s wall, ~$0.003 LLM cost.
