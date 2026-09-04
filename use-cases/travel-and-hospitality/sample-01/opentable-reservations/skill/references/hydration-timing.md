# Search-page hydration timing

**When to consult this:** snapshot looks empty (no Reserve buttons, or missing expected cards) immediately after `bb browse wait load` completes on `/s?...`.

## What's happening

OpenTable's `/s?` page renders the shell quickly (<2s from `wait load`) but fetches restaurant availability via XHR afterwards. Time-slot cards only become visible in the a11y tree at roughly 10s post-load. Snapshotting too early captures the shell without the cards.

## Heuristic

Wait a **fixed 15 seconds** (with safety margin) between `bb browse wait load` and the first `bb browse snapshot`:

```
bb browse --connect <sid> open <search URL>
bb browse --connect <sid> wait load
bb browse --connect <sid> wait timeout 15000   # or time.sleep(15) in Python
bb browse --connect <sid> snapshot
```

**Don't poll with repeated snapshots** (e.g. 1Hz until a card appears). Snapshot calls churn the CDP connection enough that Browserbase can terminate the session mid-flight with `Session with given id not found`. Use one fixed sleep, snapshot once.

The 15s value is empirically validated across SF + NYC metros, multiple proxy regions, and every venue category (standard, CC-hold, tiered, experience). Earlier values (8s, 10s) would sometimes race on slower hydration; higher values (>20s) don't measurably improve pass rate.

## How `reference.py` handles this deterministically

- `_HYDRATION_WAIT_SEC = 15` constant at module level.
- `wait_for_hydration(session_id, max_seconds=15)` does exactly `time.sleep(max_seconds); browse(sid, "snapshot")`.
- Called once in `search_opentable` and once in `book_opentable` post-load.

## Graduation history

- Discovered 2026-04-20 during regression testing — prior 8s wait raced hydration when OpenTable's XHR latency crept to ~10-12s.
- Polling-based implementation was tried and abandoned — CDP connection churn caused mid-flight session termination.
