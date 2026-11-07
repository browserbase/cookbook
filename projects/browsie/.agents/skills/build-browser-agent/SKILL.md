---
name: build-browser-agent
description: Build or adapt a consumer browser agent with Stagehand v4 and Browserbase using the Browsie pattern. Use for adding persistent browser tools, Browserbase Contexts, vaults, human handoff, CAPTCHA state, channels, or an inspection UI to an agent application. Do not use for a simple fixed browser script without an agent loop.
---

# Build a consumer browser agent

Use Browsie as a working reference, not as a generic framework. Preserve the user's selected agent
harness and product shape unless they ask to change them.

## Start with the target

Read the target repository guidance and identify:

- The agent harness and its durable-session model.
- The browser runtime and where its lifecycle belongs.
- The user channels.
- The identity, secret-storage, and human-handoff requirements.
- The inspection and event surfaces.

When working inside Browsie, read `AGENTS.md` first. Then read only the guide needed for the change:

- `docs/stagehand-harness.md` for tools, lifecycle, and harness integration.
- `docs/contexts-and-vaults.md` for browser identity and credential boundaries.
- `docs/vault-and-otp.md` for native vaults, 1Password, OTP, and Live View handoff.
- `docs/stagehand-v4-doc-map.md` before relying on a Stagehand or Browserbase API.

Check the current official documentation when behavior can change. Start with the
[Stagehand integration overview](https://docs.stagehand.dev/v4/integrations/overview), the
[Browserbase Context guide](https://docs.browserbase.com/platform/browser/core-features/contexts),
and the
[Browserbase Live View guide](https://docs.browserbase.com/platform/browser/observability/session-live-view).

## Keep the layers separate

- The system instructions define identity, general browser behavior, verification, and recovery.
- Tool descriptions define one tool's contract and its correct call conditions.
- Runtime skills contain site-specific or task-specific procedures.
- Client context supplies user, session, or workspace state.
- Browserbase Contexts store cookies and browser data.
- Vault adapters supply credentials without exposing secret values to the model or trace.

Do not solve weak tool contracts with a larger system prompt. Do not put credentials in any model
layer.

## Browser contract

Prefer one persistent browser and three basic tools:

- `snapshot` reads compact page state and fresh target IDs.
- `run` accepts either Playwright-shaped JavaScript or a short batch of snapshot-ID actions.
- `screenshot` verifies visual state.

Keep the same browser alive across tool calls and turns in one durable conversation. Do not create
a new browser or MCP process for each call. Add product tools, such as Context selection or human
handoff, only when they represent a separate capability.

For the shared Stagehand v4 contract, expose exactly one of `code` or `actions` per `run` call.
Use code for navigation, multi-step logic, waits, and extraction. Use actions with `op` and `id`
for simple work on the latest snapshot. Run code in Stagehand's browser-side callback batch, not
with `eval` or `Function` in the agent host process.

## Identity and recovery

For a hosted consumer agent:

1. Create or attach a draft Browserbase Context before the first browser action.
2. Start the session with Context persistence enabled.
3. Promote the same Context when the user asks to save the login.
4. Reuse the saved Context in later sessions.
5. Keep credentials in the native vault or an external vault adapter, not in the Context catalog.
6. Use a short-lived Browsie Live View link when the user must enter an OTP, approve a login, or
   complete another human-only step.
7. Record CAPTCHA solving, waiting, cancellation, failure, and recovery in durable task state.

Keep managed proxies and Verified Browsers enabled on every hosted session and retry. Apply an
explicit proxy location before the session starts when the user requests one.

## Channels and inspection

Web, iMessage, and future channels must call the same durable agent. Do not duplicate the browser
loop inside a channel adapter.

Keep an inspection surface that can show:

- The live browser.
- The active tool and redacted tool input.
- The exact browser code or actions that ran.
- The active Context and skill.
- Durable task events and recovery state.

Show useful explanations, but do not expose passwords, tokens, cookies, OTPs, raw debugger URLs,
or private page data.

## Verify the result

Test the behavior that changed. For a complete reference build, verify:

- A multi-turn task uses one browser.
- Cancellation stops agent and browser work.
- A login Context saves and works in a later session.
- Human handoff resumes the same task.
- CAPTCHA events enter and leave the solving state.
- A process restart reconnects to the hosted browser when supported.
- Web and messaging channels keep conversation continuity.
- Events and traces are useful and redacted.

Use mocks for normal tests. Run paid or live tests only with explicit credentials, authorization,
and a bounded session budget.

## Finish

Explain the architecture choice, changed files, required credentials, checks, skipped live tests,
and any security or cost effect. Do not claim that a live integration works when only mocks ran.
