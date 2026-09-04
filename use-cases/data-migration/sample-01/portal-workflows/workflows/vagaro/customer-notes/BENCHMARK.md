# vagaro/customer-notes — benchmark

PII-free. Counts and timings only; no customer data.

## Result: 20/20 runs, zero failures, byte-identical output

| Metric | Value |
|--------|-------|
| Runs | 20 (run 1-at-a-time / low concurrency) |
| Pass rate | 20/20 (100%) |
| Notes extracted | 36 every run |
| Coverage | 2,913 / 2,913 customers answered every run |
| Phone filled | 34/36 every run (2 have no number on file) |
| Duration | 2.6–3.2 min/run (~2.8 min avg) |
| LLM cost | ~$0.07/run avg (~$1.43 total) · Claude Haiku 4.5 |

Run labels under `results/` (gitignored): `tool-5x-b` (5), `tool-validate` (3), `benchmark-12` (12).

## Approach

- **Hybrid agent + deterministic tool.** The Stagehand LLM agent only navigates and captures one live
  API request, then calls a fixed-code tool (`tool.ts`, registered as `extractAllNotes`) that does the
  heavy lifting. The agent never drives the per-customer loop — that removed the run-to-run variance
  (churn, under-pull, off-script thrash, hangs) we saw when the loop was agent-improvised.
- **API replay, not page scraping.** The tool pulls all customers in one full-pull call
  (`customers/retrieve`, `LastSyncTime=0`), then replays Vagaro's per-customer notes API
  (`notes/retrieve`, encrypted `consumerId` header) with dedup-by-note-id, an answered-set that
  converges on re-passes, bounded concurrency, and a hard wall-clock deadline.
- **Self-healing capture.** `customers/retrieve` fires on page load and is often missed; the tool
  reconstructs it from the captured `notes/retrieve` (shared host/region/auth), so the agent's only
  hard requirement is a single Notes-tab click. This closed the one flaky case (1/5) seen pre-fix.

## Known gap

- `noteAuthor` is always empty — Vagaro's API does not expose it. All other fields are complete.
