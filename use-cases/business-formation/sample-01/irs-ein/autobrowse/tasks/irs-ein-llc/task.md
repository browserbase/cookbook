# IRS EIN Online Assistant — Single-Member LLC

## Goal

Use the **IRS EIN Online Assistant** to explore the flow for **Use case 2: IRS EIN Application** from the Sample Organization POC tracker. The agent should map and complete the application with mock customer inputs through the final **Review & Submit** page, then stop.

This is a live federal tax application. The purpose of this run is to prove that an exploratory browser agent can navigate the form, identify every required field, and produce a deterministic Playwright script for a Sample Organization demo. It must **never actually submit the application** or obtain an EIN.

## Source Scenario

- Tracker: `sample_org/docs/[External] Sample Organization x Browserbase — POC Use Case Tracker.xlsx` (at repo root)
- Use case: `Use case 2: IRS EIN Application`
- Portal: `https://sa.www4.irs.gov/applyein/legalStructure`
- Login required: No
- Primary POC question: Can an agent complete the IRS EIN Online Assistant using customer inputs, including SSN, without being blocked?
- Important constraint from tracker: IRS sessions expire quickly; assume a roughly 15-minute start-to-finish constraint.

## Inputs

Use these mock values unless environment variables override them:

- Legal structure: Limited Liability Company (LLC)
- LLC members: `1`
- State where business is physically located: `CA`
- Reason for applying: Started a new business
- Responsible party SSN/ITIN: `$EIN_RESPONSIBLE_SSN`
- Responsible party first name: `$EIN_RESPONSIBLE_FIRST_NAME`
- Responsible party middle initial: `$EIN_RESPONSIBLE_MIDDLE_NAME`
- Responsible party last name: `$EIN_RESPONSIBLE_LAST_NAME`
- Responsible party role: owner/member/managing member of the LLC
- Business legal name: `$EIN_BUSINESS_NAME`
- Trade name / DBA: `$EIN_TRADE_NAME`
- County: `$EIN_COUNTY`
- State/Territory where articles were filed: `CA`
- Start date: current month/year unless the form requires a past date
- Closing month of accounting year: December
- Physical address: `$EIN_ADDRESS_LINE1`, `$EIN_CITY`, `$EIN_STATE`, `$EIN_ZIP`
- Mailing address: same as physical address if the form offers that option
- Phone number: `$EIN_PHONE`
- Highest number of employees expected in next 12 months: Agricultural `0`, Household `0`, Other `0`
- First wages date: choose "No employees" / "No wages" path if available
- Principal activity: Other / professional services, with a simple description like `Software consulting`

If the form asks for a value not listed here, use a sensible mock value. Do not invent real personal data.

## CRITICAL GUARDRAILS — do not violate

The IRS EIN Online Assistant can issue a real EIN. You MUST stop before any action that submits the application or requests the EIN assignment.

Never click a button or link labeled:

- `Submit`
- `Submit Application`
- `Review and Submit` if it performs submission rather than navigation to a review page
- `Continue` from the final Review & Submit page if the next page is EIN Assignment
- `Get EIN`
- `Assign EIN`
- `Apply`
- any equivalent final-submission verb

Stop immediately when:

- The progress tracker shows **Review & Submit active** and the page contains a final certification, perjury statement, or final submission action.
- The next action would advance from **Review & Submit** to **EIN Assignment**.
- You are one click away from generating or receiving an EIN.

When stopping, capture the URL, page title/body summary, visible final button label, and the fields completed. Return JSON. Do not click further.

## URL

Start at:

```text
https://sa.www4.irs.gov/applyein/legalStructure
```

## Workflow

1. Open the start URL.
2. Select `Limited Liability Company (LLC)`.
3. Fill LLC details when they appear:
   - members: `1`
   - state: `California (CA)`
   - reason: `Started a new business`
4. Continue to Identity.
5. Fill responsible party identity using mock values.
6. Continue through Addresses, Additional Details, and any confirmation screens.
7. On **Review & Submit**, stop before submission and return the final JSON.

## Output

```json
{
  "success": true,
  "stopped_at_step": "Review & Submit",
  "stopped_at_url": "<string>",
  "next_button_label_at_stop": "<string>",
  "fields_completed": ["<string>"],
  "application_summary": {
    "legal_structure": "Single-Member LLC",
    "reason_for_applying": "Started a new business",
    "responsible_party": "<mock first/last only; do not include SSN>",
    "business_name": "<string>",
    "physical_address": "<string>",
    "mailing_address": "<string>",
    "phone": "<string>",
    "employees_expected": "<string>",
    "principal_activity": "<string>"
  },
  "guardrail": "Stopped before final IRS EIN submission"
}
```

Set `success: false` with a `reason` field if:

- The IRS site is outside operating hours.
- A session timeout occurs.
- A bot blocker, CAPTCHA, maintenance screen, or unexpected IRS error appears.
- A field cannot be located or filled.
- Any guardrail is about to be violated.
