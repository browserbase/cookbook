# ca-edd-enroll Navigation Strategy

Learned across iterations. Refine with one targeted heuristic per iteration.

## Environment

- Browser is **pre-attached** to a verified Browserbase session created by the outer orchestrator with `--proxies --verified --solve-captchas`. **Skip session lifecycle commands** (`browse env`, `browse stop`, `browse status`, `browse cloud sessions create`) — they would create a SECOND session and you'd lose the verified one.
- The system prompt above gives you the exact `--cdp '<wss-url>'` attach flag. **Every `browse` command MUST include that exact `--cdp '<url>'` flag at the END (after the subcommand and its positional args)**. The URL is single-quoted because it contains `=` and `?`.
- Correct: `browse fill "#txtUserID" "bbDemo2026" --cdp 'wss://connect.usw2.browserbase.com/?signingKey=...'`
- WRONG: `browse --cdp '<url>' fill "#txtUserID" "..."` — errors with "command not found".
- WRONG: `browse fill "#txtUserID" "..." --session <UUID>` — creates a different non-verified session, you lose the Verified config.
- The fast-path examples below omit the flag for brevity — always add it.
- Two distinct domains in the flow:
  - **`eddservices.mfa.edd.ca.gov`** — IBM Security Verify MFA portal. The starting URL lands here, showing the "Employer Services Online Login" page.
  - **`eddservices.edd.ca.gov`** — the AccountServlet at `/acctservices/AccountManagement/AccountServlet`. The enrollment form lives here. The "Enroll" button on the MFA page POSTs `Command=NEW_SIGN_UP` to redirect here.
- Akamai bot management is active on both domains (`ak_bmsc` cookie). The stealth flags clear it on the initial GET; subsequent navigations should also be fine, but **don't open the same URL repeatedly in a tight loop** — that's the cheapest way to trip a challenge.

## Hard guardrails — never violate

This is a real CA government enrollment system. **Stop at any final-submission button**. The "Enroll" button on the *login* page is safe (it kicks off the flow). The dangerous "Submit / Complete Enrollment / Finish" buttons are the ones at the *end*. See task.md for the full list.

**The email-verification screen is NOT a final-submission boundary.** Stop, emit `reason: awaiting_email_verification`, do nothing else. The outer orchestrator will fetch the link from the AgentMail inbox and call `page.goto(link)` in the same session.

## Phase 1 — Pre-verification (PROVEN FAST PATH — execute these commands verbatim)

The orchestrator already navigated to the EDD landing page. The form's CSS selectors are confirmed by DOM dump (see field IDs below). **Skip exploration on this phase — just execute the commands.** Goal: complete Phase 1 in under 20 turns.

### Step 1.0 — Confirm landing
```
browse get url
```
You should be on `eddservices.mfa.edd.ca.gov/...`. If not, something is wrong — snapshot + report.

### Step 1.1 — Click Enroll
```
browse click "#enroll-button"
browse wait load
browse wait timeout 2000
```

You should now be at `eddservices.edd.ca.gov/acctservices/AccountManagement/AccountServlet` titled "e-Services for Business Enrollment". If the page is "Access Denied" with an Akamai Reference #, jump to the **Akamai bot-challenge handling** section below.

### Step 1.2 — Fill the form via CSS selectors (no snapshot needed between fills)

The form has these confirmed input IDs:

| Field | Selector | Value | Constraint |
|---|---|---|---|
| Username | `#txtUserID` | $TEST_USERNAME (per task.md inputs — randomized per run) | 8–15 chars, ≥1 letter, ≥1 digit |
| Password | `#txtPassword` | `BbDemo2026!` | 8–12 chars, upper+lower+digit+special (special must be one of `!`, `$`, `@`) |
| Confirm password | `#txtPasswordConfirm` | `BbDemo2026!` | match Password |
| First name | `#txtFirstName` | (from task.md input) | |
| Last name | `#txtLastName` | (from task.md input) | |
| PIN / SSN-last-4 | `#txtSSN` | `1234` | 4 digits — use PIN form, NOT a real SSN |
| Email | `#txtPrimaryEmail` | (`$AGENT_EMAIL` from task.md) | |
| Confirm email | `#txtPrimaryEmailConfirm` | same as Email | match |
| Phone (optional) | `#txtPhoneNum` | (from task.md input) | **MUST be xxx-xxx-xxxx with dashes** — raw 10 digits triggers a validation error and silently clears the password fields |

Run each fill as a separate command (no snapshot between):
```
browse fill "#txtUserID" "bbDemo2026"
browse fill "#txtPassword" "BbDemo2026!"
browse fill "#txtPasswordConfirm" "BbDemo2026!"
browse fill "#txtFirstName" "<first>"
browse fill "#txtLastName" "<last>"
browse fill "#txtSSN" "1234"
browse fill "#txtPrimaryEmail" "<email>"
browse fill "#txtPrimaryEmailConfirm" "<email>"
browse fill "#txtPhoneNum" "<phone>"
```

Then ONE snapshot to confirm the page accepted the values (look for password-criteria checkmarks all green).

### Step 1.3 — Submit
Find the "Next" button. It's labeled "Next" — try in order:
```
browse click "button:has-text('Next')"
```
If that fails:
```
browse snapshot
```
Find the button by ref in the snapshot and click it directly.

```
browse wait load
browse wait timeout 3000
browse get url
```

### Step 1.4 — Detect the email-verification screen

Take ONE snapshot. The page should show wording like "Check your email" / "We have sent" / "Verification email" / "Confirm your email" / "We sent an email to <address>".

If you see ANY of those:
```json
{
  "success": true,
  "phase": "1",
  "stopped_at_step": "Email verification — Check your inbox",
  "stopped_at_url": "<current url>",
  "reason": "awaiting_email_verification",
  "fields_completed": ["username", "password", "first_name", "last_name", "pin", "email", "phone"],
  "next_button_label_at_stop": null,
  "agent_email": "<the email you submitted>"
}
```
STOP. Emit final JSON. Done with Phase 1.

If the page shows "Access Denied" / Akamai reference: see Akamai handling below.
If the page shows field-validation errors (e.g. "Username already in use"): emit `reason: error` with `notes` describing the error and STOP.

## Phase 1.5 — Security Questions (discovered in run-008)

After clicking Next on the enrollment form, EDD inserts a **Security Questions** step BEFORE the email-verification step. The page asks for **4 questions + 4 answers**.

### Phone-format gotcha (also from run-008)

Run-008 first hit a validation error: `"Invalid Phone Number. Phone numbers must be entered in the format of xxx-xxx-xxxx (numbers separated by dashes)."`

**Fix**: pass phone as `415-555-0199` (with dashes), NOT `4155550199`. The agent must format with dashes before filling `#txtPhoneNum`.

When phone validation fails, EDD also CLEARS the password fields silently. Re-fill `#txtPassword` and `#txtPasswordConfirm` along with the corrected phone.

### Security Questions — use `browse select` with the underlying `<select>` ref

Run-010 discovered: the question dropdowns ARE native `<select>` elements (just styled custom). The styled wrapper is decorative — `browse select "@1-XXXX" "option text"` works directly. CSS selectors like `#selectQuestionSet1` do NOT work (the IDs are on the styled wrapper, not the underlying select).

The working pattern (from run-010, turns 53-56):
1. `browse snapshot` — find the select refs (they appear as `select` nodes with `combobox` role)
2. `browse select "@1-XXXX" "question text"` for each of the 4 selects, using DIFFERENT questions
3. Fill the answer textboxes (separate refs near each select)
4. Click Continue

For **4 questions** (must be unique — EDD validates):
- Q1: "What is your favorite movie?" → answer "Avatar"
- Q2: "What is your favorite food?" → answer "Pizza"
- Q3: "What is your favorite animal?" → answer "Dog"
- Q4: "What is the name of your favorite fictional character?" → answer "Superman"

Continue button: identified by snapshot as `@1-7113` (button) in run-010 — but the ref number changes per session. Use `browse get text "main"` to find it by visible text "Continue" or "Next" or "Submit Enrollment", then click that ref.

### Phase 1.7 — Enrollment Summary → click Submit (run-010 confirmed)

After the Security Questions click-through, you land on a page titled "**Enrollment Summary**". This is a REVIEW screen showing all the values you submitted. There is a "Submit" button at the bottom.

**Click Submit here.** Per task.md GUARDRAILS, this Submit is the email-verification trigger — it is PERMITTED. It does NOT file a tax return or benefits claim; it just queues the activation email.

After Submit, the page should show "Check your email" / "An activation email has been sent to" / similar.

**Emit `reason: awaiting_email_verification` and STOP.** Do not click any further buttons on the post-Submit page.

## Recovery: "Email already exists" during Phase 1

Discovered in run-014: AgentMail addresses can recycle. If you submit the Phase 1 enrollment form and EDD returns "Email already exists. Provide a different email." — the credentials are presumably from a prior run that completed enrollment. Don't try to re-enroll with a different email; the existing account already works. **Switch to Phase 2 login flow immediately**: navigate to the login page (start URL) and use the SAME credentials ($TEST_USERNAME (per task.md inputs — randomized per run) / `BbDemo2026!`). Skip to Phase 2 Step 2.3 below.

## Phase 2 — Post-activation login (confirmed in run-011/12)

The orchestrator already clicked the activation link in your same session. You start Phase 2 on a page titled **"Enrollment Verification"** with body text "Email Confirmed — Go to Employer Services Online and select your service to log in." There is one visible button: **"Employer Services Online"**.

### Step 2.1 — Verify you're on the success page

```
browse get title --cdp '...'
browse get text "main" --cdp '...'
```
Title should be "Enrollment Verification". Text should contain "Email Confirmed". If something else → emit `reason: error`.

### Step 2.2 — Navigate back to the login page

```
browse click "button:has-text('Employer Services Online')" --cdp '...'
browse wait load --cdp '...'
browse wait timeout 2000 --cdp '...'
```
Should land back at `eddservices.mfa.edd.ca.gov/...` showing the "Employer Services Online Login" page from Phase 1 step 1.

### Step 2.3 — Log in with the credentials you just registered

The login form on the MFA portal landing page uses these field IDs (confirmed in the landing-page HTML recon):
- Username: `#user-name-input` (also named `username` — same field)
- Password: `#password-input`
- Submit: **`#login-button`** ← the BLUE "Log in" button at the top of the button row

**CRITICAL:** Do NOT click `#enroll-button` here — that's the GRAY "Enroll" button at the bottom which restarts the new-account flow and would create a duplicate account / hit "Email already exists". You want `#login-button` only.

```
browse fill "#user-name-input" "bbDemo2026" --cdp '...'
browse fill "#password-input" "BbDemo2026!" --cdp '...'
browse click "#login-button" --cdp '...'
browse wait load --cdp '...'
browse wait timeout 3000 --cdp '...'
browse get url --cdp '...'
browse get title --cdp '...'
```

### Step 2.4 — Handle the next state

EDD's login is gated by "Login Verification" (MFA). After clicking Log in, expect one of:

- **One-Time Password Submission page** (run-019/020 finding — title literally "One-Time Password Submission" or body text "Enter the verification code you received at &lt;agent-email&gt;"): the system auto-sent an email OTP to your AgentMail inbox. Stop with `reason: awaiting_email_otp`. **The orchestrator picks up the code from AgentMail and dispatches Phase 3 to submit it.**
- **MFA enrollment prompt** (asks you to enroll a NEW factor — TOTP, SMS, authenticator app — and there is no OTP code-entry field yet): stop with `reason: mfa_enrollment_required` (or `reason: sms_gate` if SMS-only).
- **Security questions challenge**: answer using the 4 Q/A pairs you set in Phase 1.5 (Movie→Avatar, Food→Pizza, Animal→Dog, Character→Superman).
- **Dashboard / service selection** ("Select a Service" / "My Profile" / "e-Services for Business" links): emit `reason: dashboard_reached` with `success: true`. (Unusual — most fresh accounts hit the email OTP page first.)
- **Akamai block**: `reason: bot_challenge`.

Do not click into any sub-service (e-Services for Business, eWOTC, SIDES) — those open ACTUAL transactional flows. Reaching the service-selection screen is the success marker.

### Phase 2 nav gotcha (run-020 finding)

The post-activation page shows an element labeled "Employer Services Online" that LOOKS like a button but is actually a `<a>` link. `browse click "button:has-text('Employer Services Online')"` may silently no-op. Instead:

1. `browse snapshot --cdp '...'` to get the ref for the link.
2. `browse click "@N-XXXX" --cdp '...'` using that ref.
3. If it lands on the public ESO Home index (`eddservices.edd.ca.gov/index.html`) instead of the login form, click ANY service link from a snapshot of that page — the service link will SSO-redirect through MFA and land you on the actual `eddservices.mfa.edd.ca.gov/...` login page.
4. `browse open https://eddservices.mfa.edd.ca.gov/...` direct nav does NOT work reliably — must click through.

## Phase 3 — Email OTP submission (run-019/020 confirmed)

The orchestrator has fetched the 6-digit OTP from AgentMail and substituted it as `$OTP_CODE` in your task.md inputs. You start Phase 3 on the **"One-Time Password Submission"** page. Goal: fill the code, submit, reach dashboard.

### Step 3.1 — Confirm starting state

```
browse get title --cdp '...'
browse get text "main" --cdp '...'
```

Title should be "One-Time Password Submission". Body text should mention "Enter the verification code you received at" + the masked AgentMail address.

### Step 3.2 — Fill OTP

```
browse snapshot --cdp '...'
```

Find the textbox ref (the only `<input type="text">` on the page). Fill it:

```
browse fill "@N-XXXX" "$OTP_CODE" --cdp '...'
```

(Try `browse fill "#otp-input" "$OTP_CODE"` first if you see a recognizable id.)

### Step 3.3 — Submit

Find the submit button (usually labeled "Submit" or "Verify"). Click by text or by ref, then wait:

```
browse wait load --cdp '...'
browse wait timeout 3000 --cdp '...'
browse get url --cdp '...'
browse get title --cdp '...'
```

### Step 3.4 — Detect outcome

- **"Set Up Login Verification"** (URL contains `LOGIN_MFA_SETUP`; offers SMS / phone-call factor enrollment) → click the **"Use my email instead"** link/button (URL contains `DISMISS_MFA_SETUP`). This dismisses the new-factor setup and keeps email-OTP as the only factor. Re-evaluate next page (should be dashboard). Confirmed working in run-023.
- **Dashboard / service-selection** → emit `reason: dashboard_reached` with `success: true`. This is the demo finish line.
- **"Trust this device"** → click "No" / "Skip" / "Don't trust". Re-evaluate.
- **Security questions challenge** → answer using Phase 1.5 Q/A pairs. Re-evaluate.
- **MFA factor-enrollment with NO email-bypass link** → `reason: mfa_enrollment_required`. STOP.
- **OTP error** ("Invalid code", "Expired") → do NOT retry. Emit `reason: error` with `notes: "OTP rejected"`.
- **Akamai block** → `reason: bot_challenge`.

## Form-filling heuristics (seeded — refine after run-001)

- Use direct CSS selectors when the form field has an `id` or `name`. The post-enroll.png snapshot shows standard `<input>` tags — no React-autocomplete quirks expected on EDD (unlike bizfile).
- Password confirmation: fill both `Password` and `Re-Enter Password` with the same value in two separate `browse fill` turns.
- Email confirmation: fill both `Email` and `Re-Enter Email` with `$AGENT_EMAIL`.
- The 4-digit PIN field accepts `1234` — do NOT type a SSN-shaped value (9 digits will be rejected by client-side max-length).
- Buttons: try `browse click button:has-text("Next")` first. If multiple match, scope by form container.

## Anti-patterns to avoid

- Do NOT use `browse wait selector` with a long timeout — confirmed flaky in `bizfile-ca-llc/strategy.md`. Prefer direct action + `browse wait load` + short `browse wait timeout 1000`.
- Do NOT navigate back to the start URL after submitting the form — the form's POST navigates you forward, and a fresh GET would lose progress.
- Do NOT snapshot after every fill — fill multiple fields then snapshot once when DOM changes.

## Akamai bot-challenge handling — STOP IMMEDIATELY (lesson from run-001)

Run-001 burned all 60 turns + $13 because the agent kept trying to recover from an Akamai block. **Recognize and exit on the FIRST sign.** Triggers:

- Page text contains "Access Denied" / "You don't have permission" / "Reference #" (Akamai's reference number format)
- Snapshot returns 0 refs after a navigation that should have produced content
- HTTP error / blank page after a form POST that previously worked

**On detection:**
1. Do ONE confirmation snapshot/get-url to record where you are
2. Emit the final JSON immediately with `success: true, reason: "bot_challenge", notes: "Akamai blocked at <url>"`
3. STOP — do not retry, do not wait, do not navigate

Trying to wait it out, refresh, or re-submit only burns turns. The block is sticky for that session. The orchestrator will rotate session + proxy on the next iteration.

## Session config (set by orchestrator)

The orchestrator passes `--proxies --verified --solve-captchas --keep-alive` to `browse cloud sessions create` (new browse CLI; replaces the old `bb` flags). If you see an Akamai block anyway, still emit `reason: bot_challenge` and stop — Verified mode is non-deterministic on EDD (~70% bypass).
