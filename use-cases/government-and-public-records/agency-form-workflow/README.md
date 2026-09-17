# County Court Browserbase Demo

Stagehand + Browserbase assessment demo for the three selected public court portals:

- FL Hillsborough HOVER: https://hover.hillsclerk.com/
- FL Lee MATRIX: https://matrix.leeclerk.org/
- MI Wayne / MiCOURT D36: https://micourt.courts.michigan.gov/case-search/court/D36

Historical session notes and replay identifiers were removed. Validate the migrated runner with your own authorized session.

## What This Demo Does

The runner opens each site with Stagehand, optionally through Browserbase, records the visible form controls, attempts only allowed form interactions, and classifies the outcome:

- `results_reached`
- `form_reached`
- `blocked_human_check`
- `blocked_site_denial`
- `blocked_terms`
- `error`

It uses Browserbase captcha solving where configured and records unresolved anti-bot states with evidence.
The runner uses deterministic field checks for submission and may call `Stagehand.extract` for MiCOURT content. It does not expose a gateway-enable/disable switch.

MiCOURT submission requires the configured first and last names, both filed-date boundaries, and the criminal/traffic checkbox to be verified. The runner checks them again after the CAPTCHA wait and before a retry. A missing or changed control stops that attempt with an error; the runner no longer substitutes a guessed field or a model-directed last-name-only search. This behavior has synthetic regression coverage; current portal compatibility still requires a separate authorized runtime check.

When remote CAPTCHA solving is enabled, `BROWSERBASE_CAPTCHA_SETTLE_MS` controls a nonnegative timed pause (default 10000 ms) at the runner's settling points. This is not a solver-completion event or a Stagehand constructor option. The obsolete `BROWSERBASE_DISABLE_STAGEHAND_API`, `BROWSERBASE_WAIT_FOR_CAPTCHA_SOLVES`, and `SAVE_SCREENSHOTS` flags have been removed; delete them from older local configuration files. This runner does not capture screenshots.

## Browser lifetime

The runner closes Stagehand and its owned browser on success, assessment failure, and initialization failure. Cleanup errors are surfaced with the original failure, and a normal report is written only after cleanup succeeds.

`BROWSERBASE_KEEP_ALIVE` defaults to `false`, so closing an owned remote browser requests session release. Set it to `true` only for an intentional live handoff: the session remains until it is ended separately or reaches its configured timeout. Full reports label this `retained_by_request`. Context persistence is requested at session termination; the runner does not confirm that the context has finished saving. Local runs close their owned Chrome process.

## Search attempt records

Full diagnostic reports include `searchAttempts` per site. Each entry captures the criteria verified before dispatch, its verification timestamp, and a dispatch state. `acknowledged` means the submission command returned; `error` means it threw and the server outcome may be unknown. Neither state proves server acceptance or fresh results. Retries append entries, and an assessment that later fails retains its earlier attempts. Default redacted reports omit the entire history.

## Report privacy

`REDACT_OUTPUT=true` (the default) writes an aggregate JSON report containing only the generation time, run mode, site identifiers, outcome statuses, and control/table/link/record counts. The writer omits search criteria, session and context metadata, URLs, page titles and text, control contents, table headers and rows, case links, model-extracted records, screenshot paths, notes, and blocker evidence. In-memory page evidence remains available to the assessment logic.

`REDACT_OUTPUT=false` explicitly retains the full diagnostic report. Each file declares its redaction mode. Treat both modes as sensitive: aggregate results are not a certification that a report is suitable for publication. This flag governs the saved JSON and final assessment summary; it does not scrub Browserbase recordings, SDK logs, previous files, or the source repository.

## Setup

```bash
cp .env.example .env
npm ci
npm test
npm run assess
```

Browserbase is enabled by default:

```bash
BROWSERBASE_API_KEY=...
USE_BROWSERBASE=true
```

Example remote launch overrides (not a statement that a portal run passed):

```bash
BROWSERBASE_PROXIES=false BROWSERBASE_OS=windows BROWSERBASE_SOLVE_CAPTCHAS=true BROWSERBASE_CAPTCHA_SETTLE_MS=20000 BROWSERBASE_VERIFIED=true SITE=lee npm run assess
BROWSERBASE_PROXIES=false BROWSERBASE_OS=windows BROWSERBASE_SOLVE_CAPTCHAS=true BROWSERBASE_CAPTCHA_SETTLE_MS=10000 BROWSERBASE_VERIFIED=true SITE=miwayne npm run assess
```

For local smoke tests:

```bash
USE_BROWSERBASE=false npm run assess
```

## Useful Runs

Assess all three sites:

```bash
npm run assess
```

Assess one site:

```bash
SITE=lee npm run assess
SITE=hillsborough npm run assess
SITE=miwayne npm run assess
```

Use authorized search criteria. By default the runner searches last name `Smith` over the last 365 days:

```bash
SEARCH_LAST_NAME=Smith SEARCH_LOOKBACK_DAYS=365 npm run assess
```

Reports are written to `results/court-assessment-*.json`.

## Current validation and remaining gaps

The manifest pins Stagehand 4.0.2. Local verification includes helper/runner regressions, a copied-source typecheck against an independently installed SDK, and a real local lifecycle run with no court tasks. These checks do not establish live court compatibility or a fresh standalone installation of this package.

Remaining gaps include removed raw-CDP operations in the challenge/dialog path, standalone lockfile/install verification, and proving that displayed result counts belong to the current submission. Do not use historical sessions as evidence that these gaps are fixed.
