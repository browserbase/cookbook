# task.md — autobrowse intent brief

**What this is.** A short brief telling autobrowse *what* flow you want automated and *how you'll know it worked* — not *how to do it*. Autobrowse + Claude Code drive a real browser session to figure out the URLs, selectors, hydration timing, warmup behavior, and retry logic on their own, iterating on a `strategy.md` until the flow passes reliably. You then graduate the converged strategy into a `SKILL.md` your runtime agent can call. See `../skill/` in this repo for the finished output.

**What to put in this file.** Just your intent: the goal, the inputs a runtime caller will pass, what success and failure look like as observable signals, and the JSON shape you want back. Don't prescribe URLs, button labels, or command sequences — those are autobrowse's job.

**What NOT to put here.** A step-by-step click sequence. If you already know the clicks, you don't need autobrowse.

**When to write one.** One `task.md` per reusable flow-class — *not* per individual request. A single "book OpenTable reservation" skill serves every restaurant × date × party combo your agent receives at runtime. You'd write a new `task.md` for a genuinely new flow (cancel, modify) or a genuinely new site (Resy, Tock).

**Run it.** From the task workspace:
```bash
node ~/.claude/skills/autobrowse/scripts/evaluate.mjs --task <task-name> --env remote
```

Budget to converge a new flow: typically 5 iterations at $0.50–$2 each → ~$5–10.

---

## Goal

One sentence describing the end state. Not the steps to get there.

> Example: "Book a table at a named OpenTable restaurant for a given date/time/party size and return the confirmation number."

## Runtime inputs

Every value your agent will pass at runtime, with types and one realistic example row. Autobrowse uses the example to drive its exploration.

> Example:
> - `restaurant_name: str` — e.g. `"Surisan"`
> - `date_time: ISO8601` — e.g. `"2026-05-29T19:30"`
> - `party_size: int` — e.g. `2`

## Auth (if required)

Does this flow need the user to be logged in? If yes, point autobrowse at a pre-authed Browserbase context:
- `BROWSERBASE_CONTEXT_ID` seeded via `/cookie-sync` against a test account

If no, leave this section out.

## Success signal

What, as an observable browser state, means "done"? Describe the signal in plain terms — let autobrowse find the exact pattern during exploration.

> Example: "The URL navigates to a confirmation page containing a numeric confirmation ID, and the page shows the reservation details matching the inputs."

## Failure signals

Which recoverable failure modes should autobrowse detect and surface as typed handoffs (vs. retrying or giving up)? Describe each in plain terms; your runtime agent uses these to decide whether to retry, re-auth, or hand off to a human.

> Examples:
> - `auth_required` — account session expired; re-run `/cookie-sync`.
> - `captcha_or_blocked` — site blocked the session; rotate proxy / try again later.
> - `no_availability` — requested slot isn't offered; surface to end user.
> - `validation_error` — form rejected the submitted data.

## Expected output JSON

The exact shape your runtime agent wants back from the graduated skill.

> Example:
> ```json
> {
>   "success": true,
>   "confirmation_number": "XXXXX",
>   "cancel_url": "https://...",
>   "error_reasoning": null
> }
> ```
>
> On failure:
> ```json
> {
>   "success": false,
>   "confirmation_number": null,
>   "error_reasoning": "<one of the failure signals above>"
> }
> ```

## Budget

Cap turns per iteration and total iterations so a runaway doesn't burn the whole budget.

> Example: `max_turns_per_iter: 20`, `max_iterations: 5`

---

**Graduation.** Once autobrowse passes 2 of 3 consecutive iterations, promote the converged `strategy.md` into a self-contained `SKILL.md` + per-heuristic `references/` (+ optional `reference.py` executor) under `skill/`. See `../skill/` in this repo for the finished shape.
