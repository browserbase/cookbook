---
name: browser-workflow
description: >
  Browse-as-Code generator. Turn a broad natural-language goal into a DETERMINISTIC
  orchestration program whose leaves are AGENTIC browser-agent loops (each leaf = one
  Anthropic Managed Agent session). Decomposes the goal, assigns a steered agent leaf per sub-task,
  selects orchestration + browser patterns from the pattern library, emits a
  runnable workflow program, and runs it. Use when the user says "create a workflow
  for <goal>", "build me a browser-agent workflow", "browse-as-code", "make a
  workflow to <do X across the web>", or wants a repeatable multi-step web automation.
license: MIT
allowed-tools: Bash Read Write Edit Glob Agent
---

# Browser-Workflow — the Browse-as-Code generator

You are the **"build" bookend** of the Browserbase platform. Given a broad goal, you
write a **deterministic orchestration program** whose **leaves are agentic** — each
leaf is a full open-ended browser-agent loop on a cloud browser. The control flow
(ordering, fan-out, loops, branches, verification) is fixed, auditable code; the
*interior* of each leaf is as open-ended as it needs to be.

> Determinism comes from the **scaffold + the structured-output contract + the
> per-leaf verifier**, NOT from making the browsing dumber.

## The one leaf that matters (for now): `agent`

The headline — and currently only — leaf is `agent()`. **Triggering a leaf = launching one
Anthropic Managed Agent (AMA) session.** The agent decides internally whether to search,
fetch, browse, click, or extract; **you steer it through the task prompt and constrain it
with a result schema.**

```js
agent(task, { resultSchema, variables, label })   // → spins up one managed-agent session ; polls ; returns result
```

### How a leaf is triggered — the default `managed` backend (VERIFIED working)

Every uncached `agent()` call launches a fresh **Anthropic Managed Agent** session and polls it to
completion. Anthropic hosts the loop AND the container, so the result returns over the same
API connection — **no Vercel, no tunnel, no callback, no infra to stand up.** `harness.mjs`
does exactly this for each leaf:

0. **Bootstrap — automatic, once per workspace.** `harness.mjs` finds-or-creates a managed agent named `browser-workflow-agent` (Opus 4.8; `agent_toolset_20260401` = `bash`/`read`/`write`/`web_fetch`/`web_search`; a leaf-agent system prompt with an anti-fabrication clause) and a cloud environment named `bac-env`. **No agent ID is hardcoded** — it works for anyone with an `ANTHROPIC_API_KEY`. Override via `BAC_AGENT_ID` / `BAC_AGENT_NAME` / `BAC_MODEL` / `BAC_ENV_NAME`.
1. **Session** — `POST /v1/sessions` `{ agent, environment_id }`.
2. **Send task** — `POST /v1/sessions/{id}/events` `{ events:[{ type:"user.message", content:[{ type:"text", text: task }] }] }`.
3. **Poll** — `GET /v1/sessions/{id}/events` until `session.status_idle` with `stop_reason.type !== "requires_action"` (or `session.status_terminated`); concatenate the `agent.message` text blocks → the leaf's result. (With a `resultSchema`, the task is suffixed with a strict "return ONLY JSON" instruction and the result is parsed.)

- **Auth/headers:** `x-api-key: $ANTHROPIC_API_KEY`, `anthropic-version: 2023-06-01`, `anthropic-beta: managed-agents-2026-04-01`. **The only requirement to run is `ANTHROPIC_API_KEY`** — no Browserbase key, no Vercel, no tunnel.
- **Fan-out is real:** each leaf is an independent managed session, so `forEach`/`parallel` give **true per-session concurrency** (unlike a single local `browse` daemon, which serializes).
- **Caveat (today's leaf):** the managed container browses a **local headless Chromium** in Anthropic's sandbox — *not* Browserbase — and there's no way to inject BB creds into it (vaults are MCP-only). Great for "make it work"; heavily bot-walled sites can block it. A true Browserbase-backed leaf (stealth / proxies / contexts) is the planned upgrade — see **Future** below.

- `task` — the steered natural-language goal for this node. **This is where you inject
  browser patterns** (e.g. "try a direct fetch first; if the page is bot-walled, drive
  it in the browser"; "after submitting, re-open the page to confirm it took").
- `resultSchema` — JSON Schema the run conforms its output to (the determinism contract).
- `variables` — sensitive values referenced by key, never shown to the model (credential brokering).
- `compute(label, fn)` — pure in-code logic (arithmetic, ranking, dedupe). No agent, no I/O. Use for anything with no judgment in it.

(Other leaf types — `search`, `fetch`, external APIs — are intentionally deferred. Add them later; for now every web step is an `agent`, and pure logic is `compute`.)

The full leaf-trigger flow is in §"How a leaf is triggered" above.

## How to generate a workflow (the procedure)

When invoked with a goal, produce a workflow in five steps:

1. **Decompose** the goal into 4–9 concrete sub-tasks a browser agent would actually perform. Mark which are independent (can fan out) vs. dependent.
2. **Assign an `agent` leaf per web sub-task**, writing a *steered* `task` prompt and a `resultSchema` for each. Use `compute` for pure-logic steps (ranking, math, dedupe). Be explicit about what each leaf returns.
3. **Pick the control flow + patterns.** Read [`patterns.md`](patterns.md) and choose: fan-out, sequence, tournament, loop-until-done, etc. — plus the **browser-native** patterns (verify-after-action, fetch-fail→browser fallback as a prompt steer, paginate-until-dry, comparative-ranking). Name the patterns you used.
4. **Emit the program** as `<name>.workflow.mjs` importing from `./harness.mjs` (`agent`, `compute`, `parallel`, `pipeline`, `forEach`, `retry`, `verify`). Deterministic control flow; agentic leaves; a `verify([...])` gate before any conclusion. Leaves with a `resultSchema` are **auto-validated and re-run** (up to `validateRetries`, default 2) until the output conforms.
5. **Run it** — `ANTHROPIC_API_KEY=... node <name>.workflow.mjs` — and present the result.

Always end with a short note listing the patterns used and the leaf count.

## Running & requirements

```bash
export ANTHROPIC_API_KEY=...     # the ONLY requirement
node <name>.workflow.mjs         # add --fresh to ignore the resume journal
```
Node 18+. The harness **self-bootstraps** its agent + environment on first run (see §"How a leaf is triggered"). No Browserbase key, no Vercel, no tunnel, no hardcoded IDs — it works in anyone's Anthropic workspace.

## Future: the Browserbase-backed leaf

Today's leaf browses a **local Chromium inside Anthropic's managed container**, so heavily bot-walled sites can block it — exactly the seam where Browserbase wins (stealth, residential proxies, persistent contexts). When the **Browserbase Agents API** ships, the leaf swaps to it behind the *same* `agent()` signature: the orchestration, the patterns, and every emitted `*.workflow.mjs` stay byte-identical. The harness is intentionally leaf-agnostic, so that's a one-function change — not a rewrite.

## Hard rules

- The control flow is **deterministic code**. Never put orchestration decisions inside a single mega-agent — decompose them into the program.
- Every leaf has a **`resultSchema`**. No free-text leaves feeding downstream logic.
- Verification agent calls must use `{ cache: false }`. Retain and inspect every check result; only a nonempty set of expected checks with `pass === true` permits a conclusion. Failed, unknown, or errored checks require a provisional result. Unknown shipping is not zero, and missing taxes or fees must be disclosed.
- Always include a **`verify([...])` gate** that checks outcomes with FRESH evidence (re-read, re-open, cross-check) — never trust a leaf's self-report. This is the load-bearing wall.
- Prefer `compute` over `agent` for anything with no judgment (ranking, arithmetic, dedupe) — don't spin a browser loop to do math.
- Pick patterns deliberately from `patterns.md` and name them in the final summary.
