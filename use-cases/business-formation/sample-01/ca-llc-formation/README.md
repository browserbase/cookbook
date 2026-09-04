# Sample Organization x Browserbase — POC

Two-week proof of concept (May 12 → May 22, 2026) evaluating Browserbase + Stagehand
for automating Sample Organization's government-portal workflows.

## Use case priority (per May 12 eng kickoff)

| # | Use case | Portal | Status |
|---|---|---|---|
| **UC1** | **CA LLC Formation** | bizfile.sos.ca.gov | v1 script ready, untested end-to-end |
| UC3 | State tax registration | EDD / CA | not started |
| UC2 | IRS EIN | sa.www4.irs.gov | not started |
| UC4 | State tax details retrieval | EDD / CA | not started |
| UC5 | State tax account closure | EDD / CA | not started |

UC1 is the sniff test — if it passes, confidence goes up significantly for the rest.

## Quick start

```bash
pnpm install
pnpm test
cp .env.example .env  # fill in API keys + bizfile creds

pnpm uc1     # walk wizard steps 1-8, click Save Draft on Step 9
```

All scripts print a Browserbase live-view URL on start so you can follow along.

The script reports a saved draft only after observing new confirmation text, a visible draft reference, and the matching LLC name. It closes the browser session before returning. A human opens
the draft from the bizfile portal, applies the signature manually, and takes
it through Step 10 (fees) and Step 11 (filing) themselves. The handoff to a
human is intentional — per the May 12 kickoff, we are not automating signing
or any action that files the LLC and charges a card.

## UC1 — CA LLC Formation

**Tracker definition:**
> Can an agent navigate the California Secretary of State filing portal, log in
> with an existing account, fill out the Articles of Organization form using
> customer inputs, and return the CA file number to Sample Organization without being blocked?

### What we learned about the portal (from May 12 recon runs)

The bizfile portal is a Single Page App with Okta-based SSO. After login the
LLC-1 filing is reached via:

1. Click **Forms** in the left sidebar → `/forms/business`
2. Click the **Articles of Organization - CA LLC** tile
3. Click the blue **FILE ONLINE** button in the popped detail panel
4. The wizard opens at `/forms/new/5072`

The wizard is **11 steps** with the navigator in the left rail:

| # | Step title | Script behavior |
|---|---|---|
| 1 | Privacy Warning / Terms and Conditions of Use | Check consent box, advance |
| 2 | Submitter | Fill Name / Email / Phone from payload, advance |
| 3 | No Professional Services | Informational page, advance |
| 4 | Limited Liability Company Name | Click "No" for reserved name, fill Name + Confirm, advance |
| 5 | Business Addresses | Fill principal + mailing forms, advance |
| 6 | Agent for Service of Process | Individual, fill name + address, advance |
| 7 | Purpose, Management and File Date | Select management radio, leave purpose/file-date defaults, advance |
| 8 | Attachments | None for a vanilla LLC, advance |
| 9 | **Review and Signature** | Click **Save Draft** and exit |
| 10 | Processing Fees | ⛔ never reached — script exits on Step 9 |
| 11 | File Document or Send for Signatures | ⛔ never reached — would file + charge |

### What's in `uc1-llc-formation.ts`

One `runUc1()` function with eight inline labelled blocks — one per wizard step —
that each issue a small handful of `stagehand.act('plain English', { variables })`
calls against the visible fields. The flow is:

- Navigation: homepage → Okta login → Forms → tile → FILE ONLINE → Step 1.
- Steps 1-8: fill the known fields with `act()`, then click "Next Step" and
  wait 12s for the SPA to rebind before the next handler.
- Step 9 ("Review and Signature"): click **Save Draft** and `extract()` the
  draft-saved confirmation and reference. A human reopens that draft from the portal to review and sign; the live view is available only while the script runs.

The script's control flow never clicks Next Step on Step 9, so Steps 10 and 11
are unreachable.

### Safety posture

- **Script-level** — the function returns after Step 9's Save Draft. Steps 10
  (Processing Fees) and 11 (File Document or Send for Signatures) are
  unreachable from this code path.
- **Manual** — the live-view URL is printed at startup. Open it to watch the
  run in real time; if anything looks off, kill the session from the
  Browserbase dashboard.
- **Account hygiene** — confirm there is no card on file for the bizfile test
  account before each run, as defense-in-depth.

### Cost & history

| Run | Approach | Outcome | Cost |
|---|---|---|---|
| 1 | Stagehand recon walk (initial) | Mapped homepage → Step 1 nav structure | ~$1 |
| 2 | Stagehand walk through wizard | Reached Step 6, crashed on tight wait | ~$2 |
| 3-5 | autobrowse (3 iterations) | Couldn't get past Step 1's snapshot | $15.81 |

**Verdict from the May 12 recon:** Stagehand's natural-language `act()` is a
better fit for this UI than autobrowse's snapshot+ref model. The dense
accessibility tree (285 refs per snapshot) overwhelms the inner agent's
ability to focus on the right element.

## Repository layout

```
sample_org/
├── data/
│   └── sample-llc-payload.json    # Dummy customer inputs (Vermillion Tide Coffee Roasters LLC)
├── uc1-llc-formation.ts           # UC1 script (pnpm uc1)
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Stack

- [Stagehand v3](https://docs.stagehand.dev) — `act()` / `extract()` / `observe()`.
- [Browserbase](https://docs.browserbase.com) — managed browser, residential proxies,
  verified browser mode, captcha solving.
- TypeScript via `tsx`. (Sample Organization is a Rails shop; the May 12 kickoff agreed to
  prototype in TS for speed of iteration, then port the proven flow.)

## Open questions for the next session

- **Step 7 fields** — is "Purpose, Management and File Date" a single form
  with all three, or sub-tabs? Confirm field-level layout.
- **Step 8 attachments** — is anything required for a vanilla CA LLC
  formation? If yes, what file types?
- **Step 9 signature** — does the review page actually require a typed
  signature, an e-signature widget, or just confirmation?
- **Payment-method on file** — the tracker creds use a real test account.
  Sample Organization should confirm there's no card on file before any further runs.

## Useful docs

### Browserbase
- [Sessions](https://docs.browserbase.com/features/sessions)
- [Proxies](https://docs.browserbase.com/features/stealth-mode/proxies)
- [Verified browser](https://docs.browserbase.com/features/stealth-mode/verified-browser)
- [Captcha solving](https://docs.browserbase.com/features/stealth-mode/captcha-solving)

### Stagehand
- [`act()`](https://docs.stagehand.dev/v3/reference/act) — atomic actions with
  `variables` substitution (used everywhere here).
- [`extract()`](https://docs.stagehand.dev/v3/reference/extract) — Zod-typed
  structured extraction (used on the review screen).
- [`observe()`](https://docs.stagehand.dev/v3/reference/observe) — find elements
  before acting; useful for form-resilience evals.
- [Evaluations](https://www.stagehand.dev/evals) — for the eval set Shubh
  and Andrew want to build over the permutations of UC3.

Actions must return `data.success === true`. The visible page must include the Review and Signature step before Save Draft is attempted. Save Draft is attempted once, without an automatic retry after an ambiguous error. Missing, stale, inconsistent or unsuccessful save evidence rejects the run; inspect the portal before retrying to avoid duplicate drafts. The result contains the observed draft reference and portal sign-in URL, not a persistent browser link. Confirmation text and references are extracted by the model and checked against newly visible page text; this is not a server-side persistence audit.

`npm test` typechecks and exercises the actual flow with synthetic SDK/page responses, including failed actions, failed or ambiguous saves, old/wrong/missing evidence, and a confirmed handoff. No portal or payload file is accessed by these tests.
