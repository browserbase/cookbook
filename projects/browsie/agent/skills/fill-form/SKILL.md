---
name: fill-form
description: Use when the user asks to fill a form in small steps while the final submit stays under user control.
---

# Fill a form

1. Read the form with `snapshot`.
2. Match user data to visible field labels. Do not invent sensitive data.
3. Fill one form step with `run`.
4. Read the page again after each step.
5. Check the completed values and use `screenshot` for visual proof.
6. Stop before the final submit unless the user clearly asks to submit.

For the Browsie demo fixture, always stop before Submit.
