# reservation portal Skill — References

Progressive-disclosure knowledge store for the booking skill. Each reference below is a self-contained heuristic — short, standard-structured, and directly tied to a deterministic encoding in `../reference.py`.

**How to use:**
- The agent running this skill consults `SKILL.md`'s "When you see…" table at the end, which maps observed page/URL signals to the reference that covers them.
- Append new findings by (a) adding a new file here, (b) adding one row to that table, and (c) optionally patching `../reference.py` to encode the fix deterministically.
- Each file follows this structure:
  1. **When to consult this** — the signal that triggers it
  2. **What's happening** — site mechanic / failure mode
  3. **Heuristic** — detection pattern + response
  4. **How `reference.py` handles this deterministically** — code pointer
  5. **Graduation history** (optional)

## Index

| File | Consult when |
|---|---|
| [`venues.md`](./venues.md) | Booking at a previously-encountered venue, or documenting a new one |
| [`metros.md`](./metros.md) | Building a search URL, or seeing a `queryUnderstandingType=dateTime` rewrite |
| [`akamai-warmup.md`](./akamai-warmup.md) | `title: Access Denied` after navigating to `/s?...` |
| [`hydration-timing.md`](./hydration-timing.md) | Snapshot looks empty after `wait load` completes |
| [`label-variants.md`](./label-variants.md) | Matching time-slot buttons, including tiered and points variants |
| [`url-path-variants.md`](./url-path-variants.md) | Post-click URL is `/booking/seating-options` or `/booking/specials`, or contains `creditCardRequired=true` |
| [`required-tc-checkbox.md`](./required-tc-checkbox.md) | `heading: Required:` + `checkbox: I agree` on `/booking/details` |
| [`low-ranked-venues.md`](./low-ranked-venues.md) | Target venue appears only as `StaticText` in the snapshot, no Reserve buttons |
