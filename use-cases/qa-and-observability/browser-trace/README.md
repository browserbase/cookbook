# app_builder-browser-trace — record→fix + a runtime-error eval (browser-trace vs local Playwright)

The record-and-fix injector masks recognized sensitive inputs before buffering
interaction events. Mark custom secret fields with `data-private` or
`data-redact`. On injection, identified password/secret events restored from
older buffers are replaced with redaction notices and require re-recording for
replay. This does not scrub existing diagnostic files or identify every possible
secret in ordinary page content; store recording artifacts securely.


This example collects evidence for an AI app-builder debugging workflow. It includes a user-recorded diagnostic bundle, an architecture deck, and a demonstration of UI assertions alongside runtime capture.

The runtime demonstration uses local Playwright with assertion-only instrumentation and a separate Browserbase run with CDP capture. Environments, listeners and wait durations differ. It does not measure diagnostic accuracy, establish a root cause, verify repairs, or show that one browser tool is more capable. Playwright can also collect runtime events when configured.

`eval/` reports assertion outcomes and observed exception, network and console-error records. It counts all recorded error categories without consulting the fixture's expected signal. Captured pages must uniquely match the case's exact data URL; absent or duplicate matches are reported as unavailable, and unexpected data pages are excluded and counted. An unrelated error still counts as an observation, never a correct diagnosis. Fixture ground truth and the runtime demo's highlighted source line are explicitly supplied reference material.

Earlier images and reports in `results/` contain unsupported root-cause scorecards. They are historical artifacts, not current evidence; they are no longer embedded or linked as results here. Generate new reports with the corrected scripts after configuring your own environment.

Run `npm test` for synthetic regression tests of the actual reporting and capture-mapping functions. These tests do not call providers, launch browsers, or read saved traces.

## The three parts

### 1. `record-and-fix/` — the diagnostic bundle
A builder-style UI (chat + a **live Browserbase iframe** as the preview). Click **Show me the
bug**, reproduce it in the preview while narrating, and it produces one artifact for the fixing
agent: **recording** (semantic actions) + **voice** (OpenAI Whisper, interleaved by timestamp) +
**exact element state** + **matched source context**, when a recorded element token maps to the repo.

```bash
npm run demo          # prints a one-time local access URL (reads .env)
```

Open the printed `127.0.0.1` URL. The token in that URL is exchanged for an
HTTP-only, same-site owner cookie; API requests without it are rejected. The
server binds only to loopback, checks the origin of state-changing requests,
and uses POST for recording and browser-control actions. Set
`DEMO_ACCESS_TOKEN` if you need a stable token for a local launcher. Do not
share the URL or expose this local demo through a tunnel.

### 2. `architecture.html` — the deck
Open in a browser. Honest walkthrough: the recording is deterministic DOM capture (not CDP
tracing); the **second read-only CDP connection** and the **CDP firehose**; and why Browserbase is
the value (operational: hosted live view, session recording, isolation, no browser in your sandbox,
scale) — **not** "local can't do CDP."

### 3. `runtime-demo/` + `eval/` — recorded signals

- `runtime-demo/capture-trace.mjs` shows one fixture's assertion outcome and captured exceptions/network observations, with supplied source shown separately. It writes `runtime-demo/report.html`.
- `eval/run-eval.mjs` runs the cases using one reused Browserbase session and maps per-page buckets by exact case URL. It writes `eval/report.html`.

```bash
npm run impact        # single-fixture signal report using the browser-trace skill
npm run eval          # assertion and signal observations across all cases
npm run impact:inline # inline CDP capture, without the browse CLI
```

---

## How it works (honest)

- **Recording:** an injected capture-phase listener (`record-and-fix/inject.js`) records each action
  with a priority list of selectors + live element state. Stable event IDs and an atomic persisted
  drain keep final and navigated interactions in the correct recording. Deterministic DOM capture, **not** CDP
  tracing and **not** the Chrome DevTools Recorder. CDP is only the transport (`connectOverCDP`).
- **Voice:** mic → OpenAI Whisper → transcript, interleaved with actions by segment timestamp
  (auto-prefers Groq if `GROQ_API_KEY` is set).
- **Code mapping:** deterministic — the route selects a candidate file, then a recorded element token
  must match that file before any source is returned. A nearby handler is labeled separately from an
  element-only match (defaults to this repo's `ui-debug-bench`).
- **browser-trace:** a **second, read-only CDP client** attached to the Browserbase session records
  the full firehose (Network / Console / Runtime / Log / Page) and bisects it per page. This is the
  [`browser-trace` skill](https://www.skills.sh/browserbase/skills/browser-trace), invoked unmodified
  by `capture-trace.mjs` / `run-eval.mjs`.
- **Fixer:** the diagnostic bundle is the input to *your* coding agent (e.g. Claude). The "fix" step
  in the live record→fix demo is illustrative; the bundle is the real, production-ready payload.

---

## Prerequisites

- Node 18+ and Google **Chrome** installed (the Playwright side uses `channel: 'chrome'` — no
  browser download needed).
- **Browserbase** API key.
- **OpenAI** (or Groq) key for Whisper voice in the record→fix demo (optional).
- The **`browse` CLI** and the **browser-trace skill** for `impact` / `eval`:
  ```bash
  npm i -g browse
  # install browser-trace: https://www.skills.sh/browserbase/skills/browser-trace
  # then point BROWSER_TRACE_DIR at its scripts/ dir (see .env.example)
  ```
  (Use `npm run impact:inline` to skip the CLI — it captures the same signals via `newCDPSession`.)

## Setup

```bash
cd qa-and-observability/browser-trace
npm install
cp .env.example .env # fill in BROWSERBASE_API_KEY, OPENAI_API_KEY
```

## Notes

- `.o11y/` (browser-trace output buckets) and generated `report.html` files are git-ignored;
  committed copies of the reports live in `results/`.
- The synthetic bench in `eval/cases.mjs` is intentionally small and extensible — add cases the same
  way as `ui-debug-bench`, or point the eval at the hosted `ui-debug-bench` apps for a stronger demo.
- In sandboxed egress the demo's failed API call shows `net::ERR_TUNNEL_CONNECTION_FAILED`; point it
  at a real failing endpoint for a literal `500`. The capture path is identical.
