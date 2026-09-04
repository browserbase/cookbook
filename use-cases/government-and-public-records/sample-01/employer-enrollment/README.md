# ca-edd-demo — autonomous CA EDD employer enrollment

An agent that completes the California Employment Development Department's
*Employer Services Online* multi-step enrollment, including two distinct email
gates (activation link + login OTP), and reaches the post-authentication
dashboard — fully end-to-end, with no human in the loop and no LLM at runtime.

The customer-facing deliverable is **one deterministic Playwright script**
that wires Browserbase (Verified mode + residential proxies + captcha solver)
together with AgentMail (per-run disposable inboxes) and runs in ~65 seconds
for under $0.10. The autobrowse exploration loop that produced it is also
shipped, so you can see how the flow was discovered.

## What this demo proves

1. **The agent owns its own email.** AgentMail provides a fresh
   `*@agentmail.to` inbox per run, used both for account registration and for
   receiving the 6-digit MFA OTP. No human inbox, no shared address pool.
2. **One browser session, three "phases", two pause-points for email.** A
   single Verified Browserbase session persists across the activation-link
   pause AND the MFA OTP pause, courtesy of `--keep-alive`. Cookies, Akamai's
   bot-management state, and the IBM Security Verify session all survive.
3. **Akamai bot-management is bypassable with Verified mode** at a ~70% rate.
   The deliverable fails fast (~1s) with a clear "re-run" message on the 30%
   block instead of timing out.
4. **The autobrowse exploration loop produced selectors the deterministic
   script then uses directly.** No LLM at runtime — the customer ships
   Playwright + AgentMail SDK only.

## The flow

```
                  ┌──────────────────────────────────────────────┐
                  │ ca-edd-enroll.ts (deterministic Playwright)  │
                  └──────────────────────────────────────────────┘

  1. AgentMail.createInbox()  →  freshfox123@agentmail.to
  2. browse cloud sessions create --proxies --verified ...

  ┌─ Phase 1 (~30s) ───────────────────────────────────────────────┐
  │  goto LANDING_URL → click #enroll-button                        │
  │  fill 9 form fields (username, password×2, name, PIN, email×2,  │
  │    phone with REQUIRED xxx-xxx-xxxx dashes)                     │
  │  click Next  ←──── Akamai bot-management gate (~70% pass)       │
  │  4 security questions: <select> + sibling <input> via XPath     │
  │  click Continue → land on Enrollment Summary                    │
  │  click Submit  →  EDD queues the activation email               │
  └─────────────────────────────────────────────────────────────────┘

  3. waitForMessage()       →  "Action Required: Confirm Your Email..."
     extractConfirmationLink({ hostMatch: /edd\.ca\.gov/i })
     page.goto(link)        →  "Email Confirmed" page

  ┌─ Phase 2 (~15s) ───────────────────────────────────────────────┐
  │  click "Employer Services Online" LINK (not a button)           │
  │  bounce through "e-Services for Business" to force MFA redirect │
  │  fill #user-name-input + #password-input → click #login-button  │
  │  land on One-Time Password Submission page (IBM macotp)         │
  └─────────────────────────────────────────────────────────────────┘

  4. waitForMessage()       →  "Employer Verification Code"
     extractOtpCode({ length: 6 })

  ┌─ Phase 3 (~10s) ───────────────────────────────────────────────┐
  │  fill OTP input → click Submit                                  │
  │  if URL contains LOGIN_MFA_SETUP:                               │
  │    click "Use my email instead"  →  dismiss new-factor enroll   │
  │  land on dashboard (eddservices.edd.ca.gov/index.html)          │
  └─────────────────────────────────────────────────────────────────┘

  5. screenshot dashboard.png, print final JSON
```

Total wall time on a clean run: **~65 seconds**. Total cost: **~$0.10** in
Browserbase session time + free-tier AgentMail.

## Quick start

```bash
cd government-and-public-records/sample-01/employer-enrollment
cp .env.example .env
# Fill in BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID, AGENTMAIL_API_KEY
# (get an AgentMail key at https://console.agentmail.to)
#
# Leave CA_EDD_ALLOW_ACCOUNT_CREATION=false for setup and checks.

# Run the deterministic Playwright deliverable:
cd autobrowse/tasks/ca-edd-enroll/playwright
ln -sf ../../../../.env .env
export CA_EDD_ALLOW_ACCOUNT_CREATION=true
npm ci
npm test
npm start
```

On a clean run you'll see:

```
[inbox] freshfox123@agentmail.to
[browserbase] session 1a2b3c...
[browserbase] live view: https://www.browserbase.com/sessions/1a2b3c...
[creds] username: bbDemo4729
[phase-1] clicking Enroll
[phase-1] filling enrollment form
[phase-1] clicking Next
[phase-1.5] answering security questions
[phase-1.5] clicking Continue
[phase-1.7] clicking Submit on Enrollment Summary
[phase-1] stopped at "Enrollment Not Yet Complete" — ...
[inbox] polling AgentMail for activation email...
[inbox] received: "Action Required: Confirm Your Email..."
[link] https://eddservices.edd.ca.gov/...&confNum=...
[phase-2] post-activation: "Enrollment Verification" — ...
[phase-2] clicking 'Employer Services Online'
[phase-2] bouncing through e-Services for Business to force MFA redirect
[phase-2] login page: "Employer Services Online Login"
[phase-2] post-login: "One-Time Password Submission - IBM Verify" — ...
[inbox] polling AgentMail for login OTP...
[inbox] received: "Employer Verification Code"
[otp] code: 216095
[phase-3] post-OTP: "Login Verification" — ...
[phase-3] dismissing 'Set Up Login Verification' via 'Use my email instead'
[done] "Employer Services Online" — https://eddservices.edd.ca.gov/index.html
{
  "success": true,
  "inbox": "freshfox123@agentmail.to",
  "username": "bbDemo4729",
  "final_url": "https://eddservices.edd.ca.gov/index.html",
  "final_title": "Employer Services Online",
  "elapsed_sec": 65
}
```

A `dashboard.png` screenshot is saved in the playwright/ directory.

On an Akamai-block run (~30% of attempts) you'll see:

```
[phase-1] clicking Next
[error] Error: Akamai bot-management blocked the request (Access Denied /
errors.edgesuite.net). Verified mode bypass is ~70% effective on EDD —
re-run to roll the dice on a fresh proxy IP. URL: ...
```

Just re-run.

## Architecture: two execution paths

### Path A — the customer artifact: deterministic Playwright

**Location:** `autobrowse/tasks/ca-edd-enroll/playwright/ca-edd-enroll.ts`

A single TypeScript file (~300 lines) that runs raw Playwright + AgentMail SDK.
No LLM at runtime, no autobrowse, no orchestrator. This is what a customer
would deploy.

Key implementation choices:
- **`browse cloud sessions create --proxies --verified --solve-captchas --keep-alive`** —
  the new Browserbase `browse` CLI replaces `bb`. `--keep-alive` is critical:
  without it the session would auto-close during the email-polling pauses,
  losing all cookies + bot-management state.
- **`page.locator("select").nth(i).locator('xpath=following::input[@type="text"][1]')`** —
  the security question answer inputs aren't labeled (`for=` is missing), and
  using `input[type="text"].nth(i)` picks up a hidden Google Custom Search box
  in the EDD page header. XPath sibling traversal from each `<select>` is the
  stable pairing.
- **`getByRole("button", { name: /^Submit$/i })`** — a loose
  `button:has-text("Submit")` matches the hidden Google search submit button
  in EDD's header (aria-hidden=true). `getByRole` skips hidden elements.
- **Fast Akamai detection** — checks page title + URL after the Next click for
  `Access Denied` / `errors.edgesuite.net` and throws immediately. Without
  this the script would hang for 30s waiting for `<select>` to appear.

### Path B — how the flow was discovered: autobrowse + AgentMail orchestrator

**Location:** `src/orchestrator.ts` + `autobrowse/tasks/ca-edd-enroll/*.md.template`

A 3-phase LLM-in-the-loop exploration tool. Each phase is a separate
[autobrowse](https://docs.browserbase.com/integrations/skills/autobrowse) run
(Claude Sonnet driving `browse` CLI subcommands one turn at a time). The outer
orchestrator owns the AgentMail inbox and the Browserbase session, and hands
off between phases:

```
orchestrator
  ├── createInbox() + createBrowserbaseSession(--keep-alive)
  ├── substitute task-phase1.md.template → task.md
  ├── spawn autobrowse #1 → emits reason: awaiting_email_verification
  ├── waitForMessage + extractConfirmationLink + page.goto(link)
  ├── substitute task-phase2.md.template → task.md
  ├── spawn autobrowse #2 → emits reason: awaiting_email_otp
  ├── waitForMessage + extractOtpCode
  ├── substitute task-phase3.md.template (with $OTP_CODE) → task.md
  └── spawn autobrowse #3 → emits reason: dashboard_reached
```

The inner autobrowse agent attaches to the orchestrator's session via
`scripts/evaluate-cdp.mjs`, which routes browser commands through an owned connection marker. It never creates its
own session and never talks to AgentMail directly — that boundary is the
orchestrator's job.

**Cost comparison:**

| Path | Wall time | Cost | LLM at runtime? |
|---|---|---|---|
| Path A (Playwright deliverable) | ~65s | ~$0.10 | no |
| Path B (autobrowse exploration) | ~13min across 3 phases | ~$8–15 (Sonnet, ~100 turns) | yes |

Path B was used to discover the selectors, gotchas, and flow ordering that
Path A then encodes deterministically. The accumulated heuristics live in
`autobrowse/tasks/ca-edd-enroll/strategy.md` — that document is the
"institutional memory" of the demo, separate from both the deliverable and
the task prompts.

## Key invariants

These are non-obvious decisions baked into the deliverable. Change at your peril:

1. **Phone must be `xxx-xxx-xxxx` with dashes.** Raw 10 digits triggers a
   validation error that ALSO silently clears the password fields, so the
   following Submit fails for a different reason than you'd expect.
2. **Password constraint: 8–12 chars, upper + lower + digit + special.** The
   only accepted special characters are `!`, `$`, `@`. `BbDemo2026!` satisfies.
3. **PIN field accepts a 4-digit value** (`1234`). Do NOT type a real SSN —
   the field has `maxlength="4"` and a 9-digit value gets truncated to the
   first 4 silently.
4. **Security questions must be 4 distinct questions.** EDD validates that all
   four questions differ. Answers must each be 3+ characters with no special
   characters.
5. **The "Submit" button on Enrollment Summary is the email-trigger, NOT the
   final finalize.** EDD's enrollment flow is: form → Submit (queues email) →
   click email link → "Email Confirmed" → log in. Clicking Submit is safe.
6. **"Use my email instead" on the LOGIN_MFA_SETUP page keeps email-only MFA.**
   EDD offers to enroll a phone-based factor (SMS/voice) after first login.
   Skipping it keeps the OTP-via-AgentMail loop deterministic across all runs.
7. **The "Employer Services Online" element on the post-activation page is a
   `<a>` link, not a button.** Click by role `link` or text, not by role
   `button`.

These all came out of the autobrowse iteration — the strategy.md file
captures them for posterity.

## Limitations

- **Akamai variance (~30%).** Verified mode is not 100%. Re-run on block.
- **Real EDD records.** Successful runs DO create real employer-services
  accounts (with plausible-but-fake PII). EDD does not validate the EIN or
  business name at enrollment — that validation only happens at the per-service
  step, which the demo never reaches. The accounts are inert (no transactions
  ever filed) but they DO persist in EDD's database. Both execution paths refuse
  to create an account unless `CA_EDD_ALLOW_ACCOUNT_CREATION=true`.
- **Stops at dashboard.** The demo does not click into any sub-service
  (e-Services for Business, eWOTC, SIDES E-Response) — those would open actual
  transactional surfaces.
- **Inbox not deleted after run.** The AgentMail inbox is intentionally kept
  alive across runs (write-once to `.last-inbox.txt`) so you can inspect it
  in the AgentMail console.

## File layout

```
ca-edd-demo/
├── README.md                                  this file
├── .env.example                               required env vars
├── package.json                               orchestrator deps (Path B)
├── src/
│   ├── orchestrator.ts                        Path B: outer agent
│   ├── browserbase.ts                         session create/release
│   ├── substitute.ts                          task.md.template var sub
│   ├── utils.ts                               retry + wait helpers
│   └── inbox/
│       ├── agentmail.ts                       createInbox + waitForMessage
│       └── extractors.ts                      extractConfirmationLink, extractOtpCode
├── tests/
│   └── extractors.test.ts                     vitest unit tests
└── autobrowse/
    └── tasks/
        └── ca-edd-enroll/
            ├── task-phase1.md.template        enrollment form → submit
            ├── task-phase2.md.template        post-link login → OTP gate
            ├── task-phase3.md.template        OTP submit → dashboard
            ├── strategy.md                    accumulated heuristics
            └── playwright/                    Path A: customer artifact
                ├── ca-edd-enroll.ts           the deterministic script
                ├── agentmail.ts               standalone AgentMail wrapper
                ├── package.json               minimal deps
                └── tsconfig.json
```

## Running the autobrowse exploration loop (Path B)

If you want to iterate on the flow yourself (e.g. adapting to a different
state's employer enrollment site), Path B is useful:

```bash
cd government-and-public-records/sample-01/employer-enrollment
export CA_EDD_ALLOW_ACCOUNT_CREATION=true
npm ci
npm test
npm run orchestrator
```

This spawns autobrowse Phase 1 → email pickup → autobrowse Phase 2 → OTP
pickup → autobrowse Phase 3. The orchestrator handles the AgentMail boundary
on your behalf; the inner agent is sandboxed to `browse` CLI only. Each phase runs in a new private `phase-N-XXXXXX/` directory inside the printed temporary workspace, with its own task and strategy copies. Its output is read only from `traces/ca-edd-enroll/run-001/summary.md` inside that invocation. Previous account runs and sibling phases are never searched for results; strategy changes are not automatically shared between phases.

**Cost warning:** a full successful exploration run costs ~$8–15 in Anthropic
API spend. Use Path A for production demos.

## Required env vars

See `.env.example`. The minimum to run Path A is:

- `BROWSERBASE_API_KEY` — from https://browserbase.com
- `BROWSERBASE_PROJECT_ID` — same console
- `AGENTMAIL_API_KEY` — from https://console.agentmail.to
- `CA_EDD_ALLOW_ACCOUNT_CREATION=true` — explicit opt-in for creating an inert
  account record in EDD

Path B additionally requires `ANTHROPIC_API_KEY` for the autobrowse inner agent.

## Install the Path B evaluator

Path B uses the evaluator from [Browserbase Skills](https://github.com/browserbase/skills/tree/b8e0afab4545afcfae35a6c8b8fca86d7b99893e/skills/autobrowse). It is a separate Node package; installing this recipe does not install it. Use the reviewed revision, whose evaluator digest matches `scripts/cdp-compatibility.json`:

```bash
git clone https://github.com/browserbase/skills.git /your/workspace/browserbase-skills
git -C /your/workspace/browserbase-skills checkout b8e0afab4545afcfae35a6c8b8fca86d7b99893e
(cd /your/workspace/browserbase-skills/skills/autobrowse && npm ci --ignore-scripts)
export CA_EDD_EVALUATOR_PATH=/your/workspace/browserbase-skills/skills/autobrowse/scripts/evaluate.mjs
```

Replace `/your/workspace` with your chosen directory. No Claude installation or global skill symlink is needed. Without this variable, the old `~/.claude/skills/autobrowse/scripts/evaluate.mjs` location remains a fallback. Relative configured paths resolve from your current directory; an absolute path is easier to reuse.

The transport also requires the reviewed `browse@0.9.6` CLI on `PATH`. Install it in a separate tool directory if needed and prepend that directory's `node_modules/.bin` to `PATH`; avoid replacing an unrelated global installation. The preflight checks its version and implementation digests before use. For a separate installation:

```bash
npm install --prefix /your/workspace/edd-cli --ignore-scripts --save-exact browse@0.9.6
export PATH="/your/workspace/edd-cli/node_modules/.bin:$PATH"
```

Back in this recipe, install its dependencies, populate the required settings from `.env.example`, then run:

```bash
npm ci
npm run check:orchestrator
npm test
```

`check:orchestrator` checks configuration presence, all three phase templates and strategy, evaluator dependencies, and transport compatibility. It does not require account-creation opt-in, create an inbox/session, or run the agent. It never prints configuration values. `npm test` also needs the configured evaluator source and compatible browse installation. Only after checks pass, explicitly set the account-creation opt-in and use `npm run orchestrator` when you intend to run the external workflow.

## CDP credential transport for Path B

The orchestrator passes its connection URL through `CA_EDD_CDP_URL` to a repo-owned evaluator adapter. The evaluator receives a non-secret marker through its supported `--connect-url` option. The browser wrapper replaces that marker in the JavaScript argument array after the process starts, and does the same for the browse daemon's serialized target. Operating-system command arguments contain the marker, not the authenticated URL. The wrapper removes the transport variables before loading browse; this does not hide credentials from privileged process-memory inspection.

The adapter redacts the connection URL and credential query values from captured browser output and failures before the evaluator can log or store them in traces. It does not claim to redact arbitrary form data, OTPs or unrelated credentials. Runtime artifacts remain private.

Compatibility is checked before inbox/session allocation. `scripts/cdp-compatibility.json` records the inspected evaluator digest and browse 0.9.6 implementation digests. A changed installation fails the preflight instead of silently losing attachment or exposing credentials. Review the installed evaluator command handler and browse daemon launch contract, then rerun transport tests before deliberately updating these digests. Global skill/CLI files are never rewritten. The adapter passes the explicit invocation workspace and fixes `--run-number 1`, matching the exact result path expected by the orchestrator.

`npm test` includes synthetic child-process transport tests, error redaction, installed evaluator/daemon function checks, existing extractor tests and typechecking. The transport tests read installed source at the usual local paths and use synthetic child scripts; they never call a model, open a browser, create an inbox or visit EDD. No live account workflow has been verified by these tests.

A failed or terminated evaluator, missing or malformed final output, incomplete evaluator status, wrong phase, or unexpected phase boundary fails the orchestrator. Phase 1 requires the email-verification boundary; Phase 2 requires the OTP boundary or dashboard; Phase 3 requires the dashboard. Missing activation links/OTPs and unavailable session-state checks also fail. These are checks on the agent report, not independent proof that the external workflow succeeded.
