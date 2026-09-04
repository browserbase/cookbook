# irs-ein-llc Navigation Strategy

## CRITICAL — Multi-word values

`browse` commands are tokenized by whitespace (no shell). `browse type <multi
word value>` types only the first token and silently drops the rest. Example:
`browse type San Francisco` → only `San` reaches the field.

**Rule:**
- `browse type <value>` — only for **single-token** values (digits, no spaces).
  SSN, ZIP, Phone — fine.
- `browse fill <ref> "<value>"` — REQUIRED for any value that may contain
  spaces. Quote the value explicitly. Street, City, business name, etc.

`browse fill` also clears the field first, so it's safe to re-issue after a
validation error.

## Addresses page (step 3 of 6) — confirmed in run-007/008

After Identity submits cleanly with a real, IRS-registered SSN, the form
advances to:

```text
https://sa.www4.irs.gov/applyein/addAddresses
```

Run-007 reached this page and filled the first 3 fields before hitting the
turn limit. Fields appear in this order, all required. No stable CSS IDs were
exposed; **take one snapshot on landing and use the refs from that
snapshot** (refs from run-007 below are illustrative — they will shift).

| Field             | Run-007 ref | Element type | Value                  |
|-------------------|-------------|--------------|------------------------|
| Street            | `[1-1652]`  | textbox      | `$EIN_ADDRESS_LINE1`   |
| City              | `[1-1661]`  | textbox      | `$EIN_CITY`            |
| State/U.S. terr.  | `[1-1822]`  | select       | `$EIN_STATE`           |
| ZIP/Postal code   | `[1-1894]`  | textbox      | `$EIN_ZIP`             |
| Phone number      | `[1-1903]`  | textbox      | `$EIN_PHONE`           |
| Different mailing → No | `[1-1917]` | radio   | (No — mailing same as physical) |
| Continue          | `[1-1926]`  | button       | —                      |

Efficient command sequence after the landing snapshot — **note the quotes
on multi-word values**:

```text
browse fill <street_ref> "$EIN_ADDRESS_LINE1"
browse fill <city_ref> "$EIN_CITY"
browse select <state_ref> $EIN_STATE
browse fill <zip_ref> $EIN_ZIP
browse fill <phone_ref> $EIN_PHONE
browse click <mailing_no_radio_ref>
browse click <continue_ref>
```

Use `browse fill` for ALL text fields here (not `browse type`) — Street and
City have spaces. Values are substituted from `.env` before the agent reads
this file, so `$EIN_ADDRESS_LINE1` becomes the literal address string at run
time. The quotes around multi-word values are REQUIRED.

Do NOT snapshot between fills — refs are stable until navigation. Snapshot
again only after Continue navigates to **Additional Details** (step 4).

## Page flow past Addresses — confirmed in run-009

The "6 steps" in the progress tracker hide sub-pages. Actual URL flow:

```
addAddresses → additionalDetails → activityAndServices → ??? → Review & Submit
```

**Additional Details** (`/additionalDetails`) — run-009 filled in ~12 turns
via refs from a single landing snapshot. Required fields included: legal
business name (`$EIN_BUSINESS_NAME`), county (`$EIN_COUNTY`), state of
articles filed (CA), accounting close month (December — but agent picked
January; revisit), close year. Several radio groups follow (employee
counts) — pick `0`/`No` paths.

**Activity and Services** (`/activityAndServices`) — progressively disclosed:
1. Principal activity radio — pick "Other" (since `$EIN_PRINCIPAL_ACTIVITY`
   is "Other") which reveals sub-questions.
2. Sub-question: type of "Other" activity — pick "Consulting".
3. Then a "Do you provide operating advice and assistance…" Yes/No — for
   software consulting, Yes is appropriate.
4. Continue button at bottom navigates onward.

After Activity and Services, expect at least one more page before
**Review & Submit**. Snapshot on landing, identify the page heading, and
proceed only if it is NOT a final-submission page. **EIN Assignment** is
the hard-stop boundary.

## Run-004 Learnings

Run-004 reached Identity and posted Continue. Mock data was rejected with
*"We are unable to provide you with an EIN... You must submit a Form SS-4 by
fax or mail."* — confirming the IRS runs a real-time TIN/name match.

Key mechanics learned that DO work and should be reused as-is:

1. **Legal Structure → Identity** path with the seeded selectors is reliable
   (~13 turns).
2. **SSN input**: `browse click #responsibleSsn` then `browse type
   $EIN_RESPONSIBLE_SSN` (nine digits, no dashes). Do NOT use `browse fill`
   (its `pressedEnter` side-effect submits the form prematurely → spurious
   "Must be 9 digits"). Do NOT use the React-setter eval — the masking
   widget intercepts `.value` reads and returns only `*`, so verification
   fails even when the value is correct.
3. The Identity-page input mechanics worked: SSN displayed `***-**-****`,
   first name + last name + role radio + Continue all posted correctly.

## Guardrails

If `$EIN_RESPONSIBLE_SSN` is a real, IRS-registered SSN, this flow can issue
a real EIN. Treat every guardrail below as hard:

- **NEVER click Submit, Submit Application, Get EIN, Assign EIN, or any
  control that advances from Review & Submit (step 5) to EIN Assignment
  (step 6).**
- The progress tracker shows six numbered circles. Step 5 = Review & Submit.
  Step 6 = EIN Assignment. The instant you see step 5 active and a final
  certification / perjury statement / submission control, STOP. Capture the
  URL + page text + visible final button label, then return JSON.
- If at any moment the page contains a final-submission action — `Submit`,
  `Submit Application`, `Get EIN`, `Assign EIN`, a perjury attestation, or a
  Continue button whose adjacent text says it generates/assigns the EIN —
  STOP IMMEDIATELY, take a screenshot, and return JSON. Do not click further.
- If you are uncertain whether a Continue button advances *within* a section
  or *completes* the application, STOP and return JSON describing the page.
  Err on the side of stopping early.
- Never include the SSN in the final JSON output.
- Before returning final JSON, collect the current URL/body summary, then
  run `browse stop` to close the remote session.

## Turn Budget (80 turns)

`AUTOBROWSE_MAX_TURNS=80`. Per-page costs from run-009 (60-turn run that
reached mid-activityAndServices):

| Section                                  | Turns | Cumulative |
|------------------------------------------|-------|-----------|
| Setup (`stop`, `env remote`, `open`)     | ~5    | 5         |
| Legal Structure (seeded selectors)       | ~9    | 14        |
| Identity (snapshot before Continue)      | ~12   | 26        |
| Addresses                                | ~10   | 36        |
| Additional Details                       | ~15   | 51        |
| Activity and Services                    | ~10   | 61        |
| Final pre-Review page(s)                 | ~10   | 71        |
| Review & Submit (snapshot + STOP)        | ~6    | 77        |

Conserve turns: snapshot only after route changes or progressively disclosed
sections. Do NOT snapshot between same-page fills — refs are stable until
navigation. Skip optional fields (middle initial, trade name, address line 2)
— only fill required (asterisked) fields. If the form takes more turns per
page than budgeted, prioritize **reaching the Review & Submit page** and
capturing its URL + body summary over filling every optional field.

## Fast Path From Start

1. `browse open https://sa.www4.irs.gov/applyein/legalStructure`
2. `browse wait load`
3. `browse snapshot`
4. Select `Limited Liability Company (LLC)`.
5. Fill/select the progressively disclosed Legal Structure fields.
6. Continue to Identity.
7. Fill Identity with the nine-digit SSN and continue.
8. Continue only through required field pages until the Review & Submit guardrail.

When using a stable selector below, do not spend extra turns hunting for refs
unless the selector fails.

## Run-002 Learnings

The first useful Autobrowse runs reached the **Identity** step, then hit the
30-turn harness limit after an SSN validation error. Preserve the successful
Legal Structure path and focus only on the SSN field behavior.

### Legal Structure fast path

After selecting LLC, the page progressively discloses additional fields on the
same URL. Use stable IDs/selectors when possible:

- Legal structure radio: `#LLClegalStructureInputid`
- LLC member count: `#membersOfLlcInput`, value `1`
- State dropdown: `#stateInputControl`, choose `California (CA)` / `CA`
- Reason radio: `#NEW_BUSINESSreasonForApplyingInputControlid`
- Continue: the `Continue` control is an anchor styled as a button; in run-002
  it appeared as a `Continue` link near the bottom of the form.

Do not assume the URL changes until after the reason is selected and Continue is clicked.

Suggested command shape, adapting only if a selector fails:

```text
browse click #LLClegalStructureInputid
browse fill #membersOfLlcInput 1
browse select #stateInputControl CA
browse click #NEW_BUSINESSreasonForApplyingInputControlid
browse click a:has-text("Continue")
```

If `browse select #stateInputControl CA` does not work, try
`browse select #stateInputControl "California (CA)"`.

### Identity page

The Identity page URL is:

```text
https://sa.www4.irs.gov/applyein/identityOfEntities
```

Stable controls observed in run-002:

- Responsible party SSN/ITIN: `#responsibleSsn`
- First name: `#responsibleFirstName`
- Last name: `#responsibleLastName`
- Owner/member role radio: `#yesentityRoleRadioInputid`

Use the SSN as **nine digits only** (no dashes). Run-002 used a dashed SSN and
the IRS page returned:

```text
Social Security Number: Must be 9 digits.
```

Run-003 used `browse fill #responsibleSsn $EIN_RESPONSIBLE_SSN`; the field
displayed as masked (`***-**-****`) but the page still returned the same
`Must be 9 digits` error. Hypothesis: `browse fill` interacts poorly with the
custom masked SSN/ITIN component, especially because it also sends Enter.

For the SSN field, use **`browse click` + `browse type`** (this is what
worked in run-004). The SSN value comes from the env var
`$EIN_RESPONSIBLE_SSN` — do NOT hardcode any digits in commands.

```text
browse click #responsibleSsn
browse type $EIN_RESPONSIBLE_SSN
browse fill #responsibleFirstName $EIN_RESPONSIBLE_FIRST_NAME
browse fill #responsibleLastName $EIN_RESPONSIBLE_LAST_NAME
browse click #yesentityRoleRadioInputid
browse snapshot
browse click <continue_ref_from_snapshot>
```

**Continue button on Identity:** `browse click a:has-text("Continue")` does
NOT navigate from Identity (confirmed in run-008 and run-009 — both clicked
something but stayed on `identityOfEntities`). The Identity page has multiple
elements matching that text. **Take a snapshot after filling the role radio,
then click the Continue button ref from that snapshot.** This costs one extra
turn but reliably navigates to Addresses.

**Do NOT** use `browse fill` on `#responsibleSsn` — it pressed Enter mid-stream
in run-002/run-003 and triggered a spurious "Must be 9 digits" error.

**Do NOT** use the React-setter eval on `#responsibleSsn` — the masking widget
intercepts `.value` reads and the eval returns only `*`, which makes
verification impossible. `browse type` (one keystroke per digit) bypasses the
masking widget and the form accepts it.

The SSN field will display masked as `***-**-****` after input. That is
correct behavior — do not retry. The first/last name fields are plain text;
`browse fill` works for them.

After clicking Continue from Identity, expect to advance to **Addresses
(step 3 of 6)** in the progress tracker. If you see "We are unable to
provide you with an EIN" on the page, the IRS rejected the responsible
party. Stop and report.

If selector-based click fails for the radio or Continue control, take one
snapshot and click the current ref from that snapshot.

## Known Site Shape

- The app is a JavaScript wizard with progress steps:
  `Legal Structure`, `Identity`, `Addresses`, `Additional Details`,
  `Review & Submit`, `EIN Assignment`.
- Continue controls may be anchors styled as buttons, not native `<button>` elements.
- Some questions are progressively disclosed on the same URL after earlier answers are selected.
- Radios can have labels that intercept pointer events; if a direct click fails, click the label text or use a selector for the associated input.
- Validation errors appear near the top and keep the user on the same progress step. Read the error text, fix only the failed field, then continue.

## Efficiency

- The harness has a 30-turn limit. Conserve turns aggressively.
- Do not take screenshots on known pages. Screenshots are only for being stuck or near the final Review & Submit guardrail.
- Prefer direct `browse fill`, `browse select`, and selector-based `browse click` for stable controls.
- Avoid click-then-type where a stable field selector exists. Prefer one direct fill per text field.
- Snapshot after route changes, after new progressively disclosed sections appear, or after a failed selector. Do not snapshot after every single field if the page is stable.
- If the model can issue several safe same-page execute calls in one assistant turn, do that for known fields, then snapshot once.
- If a command returns `pressedEnter: true`, do not panic. Snapshot only if Enter may have triggered validation or navigation.
