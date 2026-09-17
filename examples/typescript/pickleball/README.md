# SF court booking with Stagehand and Browserbase

An interactive TypeScript example for selecting a tennis or pickleball reservation in San Francisco Recreation & Parks. It asks you to review the specific court, facility, date, local start/end time, participant, and displayed price before submitting.

## Setup

From the cookbook root:

```sh
cd examples/typescript/pickleball
pnpm install --config.minimumReleaseAge=10080
cp .env.example .env
pnpm start
```

Use pnpm **10.24.0**, as declared in `package.json`. Configure the Browserbase API key and the SF Rec Park email/password in your local `.env`. You also need access to the model configured in `index.ts`, currently `openai/gpt-4.1`. Create your own account at [SF Rec & Park](https://www.rec.us/organizations/san-francisco-rec-park) before running the example.

This command can submit a real reservation and trigger verification messages. Read the displayed reservation and price before approving it. Approval defaults to **No**. Do not put credentials or verification codes in source control.

## Booking flow

1. Choose Tennis or Pickleball, a San Francisco calendar date, and a time period.
2. Log in, apply filters, and look for a selectable slot within those preferences. The script does not silently switch time periods when none is found.
3. Open a slot and select a named participant. Duplicate participant names stop the workflow because the choice is ambiguous.
4. Read the selected reservation details. A wrong activity/date, invalid time range, or start outside the requested period stops before submission.
5. Review the court, facility, date, time, participant, and price. After approval, the script reads the summary again and rejects any change before pressing Book.
6. Complete the verification-code prompt. Each booking action must return `data.success: true`. Explicit rejection takes precedence over positive text, and an unknown immediate outcome stops before navigating away.
7. Open the newly created reservation details in the Rec profile. A structured receipt must contain a nonempty reservation ID and match every reviewed detail. An ID already present before submission is rejected.

Morning means a start before noon; Afternoon means a start from noon onward; Evening means a start from 17:00 onward. These preserve the existing menu's overlapping afternoon/evening ranges. Times refer to `America/Los_Angeles`.

The verification code is masked in the terminal prompt and is not printed by the script. It still passes through a model action prompt, so this example does not establish trace or recording privacy.

## What the result proves

The script validates structured model output against the reviewed reservation. Generic success text cannot satisfy the receipt schema. However, this is not yet independent verification of a server-side reservation: the profile receipt reader and its identity/freshness evidence have not been validated against the real authenticated page. A copied `visibleReceiptText` field is also model output, not independent DOM evidence.

Public deployed site code shows that the court success dialog displays a success message and date/time/location, then directs users to their Rec profile for reservation details. The dialog alone does not provide the complete receipt required here. If the profile cannot supply it, the command fails as unknown. Check your account's reservations before retrying an uncertain attempt, because it may already have succeeded.

## Calendar dates

The date menu uses San Francisco's current date and calendar-date arithmetic for subsequent days. Labels and `YYYY-MM-DD` values stay consistent across computer timezones, midnight, daylight-saving transitions, leap days, and year boundaries.

The calendar selector navigates to the full month/year, selects the exact enabled `data-day` cell, and reads back its selected state. It rechecks the date before opening a booking slot. Missing, ambiguous, stuck, or incorrect calendar state fails. A bounded wait after navigation avoids repeated clicks during delayed rendering.

## Local verification

```sh
pnpm test
pnpm typecheck
```

With Node.js 24, 59 tests passed: 20 date/calendar tests and 39 booking/receipt/caller cases. The latter execute the actual functions with synthetic browser, model, and prompt responses and use the real Zod schemas, including JSON Schema conversion required by Stagehand. Coverage includes declined approval, changed checkout details, failed actions, explicit rejection, missing or mismatched receipt fields, an existing reservation ID, and the caller's failure path.

The full four-module TypeScript runner passed an isolated type check against Stagehand 4.0.2, Zod 4.4.3 and Inquirer 12.11.1. Inquirer was installed in an isolated directory under the normal seven-day package policy; this is not a fresh installation of the complete recipe dependency graph.

The calendar helper separately passed six local Chrome scenarios using the actual Stagehand 4.0.2 `Page`/`Locator` classes and RPC schema checks against a synthetic calendar with network requests blocked. This validates that local interaction contract. No live login, verification message, booking, or authenticated profile receipt was executed for these checks.

## References

- [Stagehand v4 documentation](https://docs.stagehand.dev/v4/first-steps/introduction)
- [Browserbase sessions](https://docs.browserbase.com/fundamentals/create-browser-session)
- [SF Rec & Park](https://www.rec.us/organizations/san-francisco-rec-park)
