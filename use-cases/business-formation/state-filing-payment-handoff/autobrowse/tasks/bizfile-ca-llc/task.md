# California LLC Formation — bizfile.sos.ca.gov

## Goal

Walk the **Articles of Organization (Form LLC-1)** flow on California's bizfile portal through the 11-step wizard, click "File Online" on Step 11 to open the payment screen, fill the credit-card form on the payment screen, and **STOP before clicking the payment-submit button**. That payment-submit click is the one that forwards the filing to the Secretary of State for review and charges the card — it must be performed by a human, not the agent.

Safety opt-in: `$BIZFILE_ALLOW_PAYMENT_HANDOFF` must be `true` before this payment-handoff flow is run. If it is not `true`, stop immediately and report that the payment handoff was not authorized.

The wizard is 11 steps, followed by a separate payment screen:

1. Privacy Warning / T&C
2. Submitter
3. No Professional Services
4. Limited Liability Company Name
5. Business Addresses
6. Agent for Service of Process
7. Purpose, Management and File Date
8. Attachments
9. Review and Signature *(must sign as organizer)*
10. Processing Fees *(review only — no input fields; click Next Step)*
11. File Document or Send for Signatures *(informational page; click the "File Online" button to advance to the payment screen — this click is SAFE, it does not file or charge anything)*
12. **Payment screen** *(Visa/Mastercard form; populate the card fields, then STOP before clicking the final payment-submit button)*

The agent must populate every required field, including the electronic signature on Step 9 and the credit-card fields on the payment screen, and land on the payment screen with all card fields filled and the final submit button visible but UNCLICKED.

The browser is **pre-authed** via a persistent Browserbase context (created by `./bootstrap-context.sh`). You should land on the bizfile dashboard already signed in. If you see a login page, the context has expired — stop and report.

## Inputs

Every LLC field comes from `.env`. There are no defaults — the script throws on startup if any value is blank, so do not invent fallbacks here.

- LLC Name: `$LLC_NAME`
- Principal address: `$LLC_PRINCIPAL_STREET`, `$LLC_PRINCIPAL_CITY`, `$LLC_PRINCIPAL_STATE`, `$LLC_PRINCIPAL_ZIP`
- Mailing address: `$LLC_MAILING_STREET`, `$LLC_MAILING_CITY`, `$LLC_MAILING_STATE`, `$LLC_MAILING_ZIP`
- Agent for Service of Process (individual, not a corporation): `$LLC_AGENT_FIRST_NAME` `$LLC_AGENT_LAST_NAME` at `$LLC_AGENT_STREET`, `$LLC_AGENT_CITY`, `$LLC_AGENT_STATE`, `$LLC_AGENT_ZIP`. For a CA-formed LLC the agent state MUST be CA.
- Management structure: `$LLC_MANAGEMENT_STRUCTURE` — one of "all members", "one manager", "more than one manager"
- Organizer name: `$LLC_ORGANIZER_NAME` — also used as the typed electronic signature on Step 9.
- Purpose statement: use the pre-filled California default ("any lawful act or activity for which a limited liability company may be organized under the California Revised Uniform Limited Liability Company Act").

Credit-card payment (the payment screen that appears after clicking "File Online" on Step 11):

- Card number: `$PAYMENT_CARD_NUMBER`
- Cardholder name: `$PAYMENT_CARDHOLDER_NAME`
- Expiration month: `$PAYMENT_CARD_EXP_MONTH`
- Expiration year: `$PAYMENT_CARD_EXP_YEAR`
- CVV: `$PAYMENT_CARD_CVV`
- Billing address: `$PAYMENT_BILLING_ADDRESS`, `$PAYMENT_BILLING_CITY`, `$PAYMENT_BILLING_STATE`, `$PAYMENT_BILLING_ZIP`

If the form prompts for any value not listed here, use a sensible placeholder (e.g., empty optional fields, "N/A" for non-required text). Do not invent a real address or real person beyond what's in env.

## CRITICAL GUARDRAIL — the only hard stop

The bizfile portal files **real legal documents** with the California Secretary of State. A submitted LLC-1 creates a real entity, incurs a $70 filing fee, and triggers ongoing legal obligations (Statement of Information, $800 annual franchise tax).

The Step 11 page (per the captured screenshot) explicitly says: *"Click **File Online** below to pay for your filing with a Visa or Mastercard. … Once your payment is submitted, the filing will be forwarded for review."* That tells us:

- **Clicking the "File Online" button on Step 11 is SAFE.** It only opens the payment form; nothing is filed and nothing is charged.
- **The legal-filing + charge trigger is the payment-submit button on the payment screen that appears AFTER File Online.** That is the only button that must never be clicked by the agent.

**Stop on the payment screen with all card fields populated and the final submit button visible but UNCLICKED.** A human must click that final button.

Buttons it is OK to click:

- "Next Step" on Steps 1–10 (these only advance the wizard).
- "One Signature" radio + typed signature on Step 9.
- "Next Step" on Step 10 (Processing Fees — review only, no input fields).
- The "File Online" button on Step 11 (opens the payment form; safe).
- Form-field inputs on the payment screen (filling card number, expiration, CVV, billing address — these are inputs, not submission buttons).

Buttons that must NOT be clicked under any circumstance:

- The final payment-submit button on the post-Step-11 payment screen. Its exact label is unknown until observed; treat ANY button on the payment screen whose label contains "Pay", "Submit Payment", "Submit", "File", "Place Order", "Complete Order", "Confirm Payment", or similar as forbidden.

If you reach the payment screen with all card fields filled, capture state (URL, every visible button label, screenshot) and return the final JSON. Do **not** click anything that could be the submit trigger.

## Starting state — IMPORTANT (hybrid mode)

The browser is **already pre-positioned on Step 9 (Review and Signature)** of the LLC-1 wizard, with all of Steps 1-8 already completed deterministically by a Playwright script. The wizard's draft state holds the filled-in values for the LLC name, addresses, agent, etc.

**Do NOT call `browse open <any-url>` at the start.** That would navigate away from the wizard and lose all the draft state. Just begin with `browse snapshot` to confirm you're on the review screen, then proceed from there.

If the first `browse snapshot` does NOT show the Step 9 Review and Signature page (e.g., shows the dashboard, a login page, or some other state), return `success: false` with `reason: "unexpected-starting-state"`. Do not try to recover by navigating — the Playwright handoff is broken; abort and let the orchestrator handle it.

## Workflow

1. `browse snapshot` — confirm you're on Step 9 Review and Signature. The page should show the wizard summary (LLC name, addresses, agent, etc.) plus an "Electronic Signature" section with "One Signature" / "Multiple Signatures" radios.
2. **Step 9 — Review and Signature**: pick "One Signature". The page reveals a signature row (or an "Add" button to add one); fill the typed signature with `$LLC_ORGANIZER_NAME`. Click Next Step.
3. **Step 10 — Processing Fees**: review-only page; just click Next Step. No input fields here. (If you see input fields or the advance button is relabeled to "Pay"/"Submit Payment", something is off — stop and report.)
4. **Step 11 — File Document or Send for Signatures**: informational page with body text "Click File Online below to pay for your filing with a Visa or Mastercard." Click the **"File Online"** button. This advances to the payment screen. This click is safe — no charge, no filing.
5. **Payment screen** (post-Step-11): fill the credit-card form from the `$PAYMENT_*` env vars (number, cardholder name, exp month/year, CVV, billing address). After all fields are populated, **STOP**. Capture the URL, every visible button label on the page, and a screenshot. Do **not** click any submission button.
6. Return the final JSON.

## Output

```json
{
  "success": true,
  "llc_name": "<string>",
  "stopped_at_step": "<string>",
  "stopped_at_url": "<string>",
  "fields_completed": ["<string>"],
  "review_summary": {
    "principal_address": "<string>",
    "mailing_address": "<string>",
    "agent_name": "<string>",
    "management_structure": "<string>",
    "organizer_name": "<string>"
  },
  "payment_summary": {
    "card_last4": "<string>",
    "cardholder_name": "<string>",
    "billing_zip": "<string>"
  },
  "filing_fee_shown": "<string|null>",
  "final_submit_button_label": "<string>"
}
```

`stopped_at_step` should be "Payment Screen (post-Step-11, all card fields populated)" on a successful run. `final_submit_button_label` is the visible label on the button the agent deliberately did not click on the payment screen.

Set `success: false` with a `reason` field if:
- The context is not authenticated.
- A form field cannot be located or filled (including any credit-card field on the payment screen).
- The agent encountered an unexpected page (e.g., maintenance, CAPTCHA wall, ToS update).
- Step 10 unexpectedly contains input fields or its advance button is labeled with a charge verb — something has changed; stop and report.
- **The payment-submit guardrail was about to be violated** (treat near-violations as a stop, not a success).
