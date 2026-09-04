# travel portal Navigation Strategy

The local script now uses this strategy shape directly, even though this environment does not currently have the `browse` CLI installed for full trace runs.

## Fast Path
- Start from `https://app.travel.example/app/user2/` with a saved Browserbase context.
- Detect page state from URL/body text before invoking an LLM classifier.
- On the travel home page, click the large "Where to?" / Location launcher to open the expanded Book a flight form.
- Stop waiting as soon as the expanded flight form is visible.
- Use the scoped Stagehand agent only for the hard part: setting one-way, From, To, date, optional nonstop, and clicking Search.
- After Search, poll visible text for prices/results before invoking final extraction.

## Efficiency Hypotheses To Validate With `/autobrowse`
- Whether a deeper Travel portal route URL opens the expanded flight form directly and skips the home launcher.
- Whether stable selectors exist for trip type, origin, destination, departure date, and Search so the form can be filled with deterministic Playwright actions.
- Whether visible price text is a reliable readiness signal across different Travel portal accounts.

## Failure Recovery
- If the page shows MFA, email verification, magic link, CAPTCHA, or a security check, stop and report `blocked`.
- If clicking the home launcher does not reveal the expanded form within 6 seconds, fall back to a scoped agent that only opens the form.
- If no price text appears within 24 seconds after Search, run one final state classification/extraction and report the visible page state.
