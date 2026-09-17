# Time-slot button label variants

**When to consult this:** matching time-slot buttons on the search page, especially when a venue renders tiered seating or points-redemption offers.

## What's happening

reservation portal renders time-slot buttons in four distinct label patterns, depending on the venue's seating model and loyalty-points status. The skill must match against all four to book reliably — any single-pattern matcher will miss venues.

## Heuristic

Four variants observed:

| Variant         | Button-label pattern                                                                                 | Where `<time>` comes from                         |
|-----------------|------------------------------------------------------------------------------------------------------|---------------------------------------------------|
| Simple          | `button: <time> Reserve table at <name> restaurant`                                                  | From the label itself                             |
| Simple + points | `button: <time> Reserve table at <name> restaurant and redeem +<N> pts`                              | From the label itself                             |
| Tiered          | `button: Select table type for reservation at <name> restaurant` + child `StaticText: <time>`        | From a child StaticText under the button node     |
| Tiered + points | `button: Select table type for reservation at <name> restaurant and redeem +<N> pts` + child `StaticText: <time>` | From a child StaticText under the button node |

`<time>` format: `H:MM AM` or `H:MM PM`, optionally with a trailing `*` asterisk. The asterisk indicates special terms on that slot (often a credit-card hold, cancellation fee, or prix-fixe requirement) — treat it as an advisory to surface to the end user, NOT as a CC-required boolean. The authoritative CC signal is the `creditCardRequired=true|false` query param on the post-click URL (see [`url-path-variants.md`](./url-path-variants.md)).

## How `reference.py` handles this deterministically

Two compiled regexes in `reference.py`:

```python
_SIMPLE_BTN = re.compile(
    r"\[(\d+-\d+)\] button: (\d{1,2}:\d{2} [AP]M)[* ]*Reserve table at ([^\n]+)"
)
_TIERED_BTN = re.compile(
    r"\[(\d+-\d+)\] button: Select table type for reservation at (.+?) restaurant[^\n]*"
    r"\n\s*\[[^\]]+\] StaticText: (\d{1,2}:\d{2} [AP]M)\*?"
)
```

`find_slot_ref(tree, restaurant, time_label)` tries both regexes, filters for matching venue name (substring match, case-insensitive after stripping the trailing " restaurant" suffix) and exact time label match. Returns the `@ref` of the first match, or `None`.

## Graduation history

- Simple + Tiered discovered during initial autobrowse matrix.
- Points variants discovered 2026-04-18 on Cucina Venti + Cafe Tiramisu during Italian SF stress testing.
- The `*` asterisk semantic (special-terms advisory, not CC boolean) clarified after State Bird Provisions testing — CC-hold was signaled by the query param, not the label.
