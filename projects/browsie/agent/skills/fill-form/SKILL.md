---
name: fill-form
description: Use when the user asks to fill a form in small steps while the final submit stays under user control.
---

# Fill a form

If the user explicitly requests one `run` call or one batch, use one code-mode `run` for the full
form workflow. Use stable labels, roles, or known selectors, and verify all final values inside that
same code call. Do not call `snapshot` or `screenshot` unless the single batch fails.

1. Read the form with `snapshot`.
2. Match user data to visible field labels. Do not invent sensitive data.
3. Fill one form step with `run`.
4. Read the page again after each step.
5. Check the completed values and use `screenshot` for visual proof.
6. Stop before the final submit unless the user clearly asks to submit.

For the Browsie demo fixture, always stop before Submit.
