# Momentic on Browserbase — testing a `localhost` app from a cloud browser

A working proof-of-concept that runs the **real [Momentic](https://momentic.ai) CLI**
E2E test runner on a **[Browserbase](https://browserbase.com) cloud browser**, against
an app that only exists on `localhost` — the exact case people assume a remote browser
*can't* handle.

It exists to answer a specific customer question: *"How is Browserbase supposed to work
for sites on `localhost`? Your CDP connection can't reach loopback."*

## The problem

A cloud browser runs in a datacenter, so `localhost:3000` (your dev server) is
meaningless to it — that address points at the cloud machine, not yours. Momentic's
other backend (Azure Playwright Workspaces) solves this with Playwright's native
`exposeNetwork: "<loopback>"`, which tunnels the browser's traffic *back* to the test
runner's machine. That only works over the **native Playwright protocol**.

Browserbase speaks **CDP** (`connectOverCDP`), which has no loopback feature — and BB
deliberately blocks connections to loopback/private addresses at the network layer.
So we solve it the other direction: **push `localhost` out** through an auth-gated
tunnel that only this session can use.

## What this demo proves

```
┌────────────────┐   momentic run (MOMENTIC_SERVER=shim)   ┌──────────────────────┐
│  Momentic CLI  │ ──────────────────────────────────────► │  shim.mjs            │
│  (your laptop) │   "give me a browser"                    │  (pass-through to    │
└───────┬────────┘ ◄────────────────────────────────────── │   api.momentic.ai,   │
        │            { wsEndpoint: <Browserbase>,           │   intercepts only    │
        │              endpointType: CDP }                  │   /browsers/connection)
        │                                                   └──────────────────────┘
        │ connectOverCDP
        ▼
┌────────────────┐      navigate (X-Tunnel-Auth header)     ┌──────────────────────┐
│  Browserbase   │ ──────────────────────────────────────► │  cloudflared tunnel  │
│  cloud browser │                                          │  (auth-gated)        │
└────────────────┘                                          └──────────┬───────────┘
                                                                        │ 127.0.0.1:3000
                                                                        ▼
                                                              ┌──────────────────────┐
                                                              │  your localhost app  │
                                                              └──────────────────────┘
```

The Momentic CLI runs its test on a Browserbase cloud browser, which loads your
`localhost`-only app through the tunnel, and the test passes — with a full session
replay + network logs in the Browserbase dashboard.

## Files

| File | What it is |
|---|---|
| `server.mjs` | A small "Acme Staging" login→dashboard app. Localhost-only. |
| `acme-signin-ai.test.yaml` | **Default.** Natural-language test — `act: Log in with email … and password …`. Momentic's AI figures out the login at runtime. |
| `acme-signin.test.yaml` | Faster JS-driven version (deterministic `querySelector` fill + click). Run with `./run-demo.sh acme-signin.test.yaml`. |
| `test-runner.config.yaml` | Momentic project config with `browser.remoteBrowser: true`. |
| `shim.mjs` | Pass-through proxy to `api.momentic.ai`. Intercepts only the browser-connection call and hands Momentic a Browserbase session. |
| `run-demo.sh` | Orchestrates the whole flow end-to-end. |

This demo depends on the `browserbase-localhost` Claude skill for the auth-gated tunnel
(`~/.claude/skills/browserbase-localhost/scripts/launch.mjs`).

## Run it

```bash
cp .env.example .env   # fill in BROWSERBASE_* and MOMENTIC_API_KEY
npm i -g momentic@latest
brew install cloudflared
./run-demo.sh
```

It prints a **WATCH LIVE** Browserbase URL and pauses so you can open it, then runs
`momentic run` and reports `✓ 1 passed · 1/1 ran on remote browser`.

## How the integration works

Momentic's CLI has no flag to point at a specific browser — when `remoteBrowser: true`,
it asks its own server (`POST /…/browsers/connection`) for one, and the server returns
`{ wsEndpoint, endpointType, provider }`. Momentic's shipping code already enumerates
`BROWSERBASE` as a provider (alongside `AZURE` and `KERNEL`) and connects via either
`chromium.connect` (PLAYWRIGHT) or `chromium.connectOverCDP` (CDP).

This demo overrides `MOMENTIC_SERVER` with a thin shim that passes everything through to
the real Momentic API **except** that one browser-connection call, which it answers with
a Browserbase session (`endpointType: CDP`). Navigation to the localhost tunnel carries
the `X-Tunnel-Auth` header via Momentic's `--custom-headers`.

## Honest caveats

- **The shim is a POC.** The production path is Momentic's own server returning a
  Browserbase session — which their code already supports. The shim just demonstrates the
  wiring without needing changes on Momentic's side.
- **Two flavors of test, both real:**
  - `acme-signin-ai.test.yaml` (default) uses a goal-based **AI action** (`act: …`). Momentic's
    AI resolves the login at runtime — genuine natural-language testing. ~45–50s (real AI
    vision/planning).
  - `acme-signin.test.yaml` uses a `javascript` step (deterministic `querySelector`). ~14s.
    Useful as a fast, deterministic fallback.
  - Note: the structured NL steps (`type: { into: … }`, `click: { on: … }`) are **not** the
    same as `act:` — they need an AI-resolved `elementDescriptor` that's generated when you
    author a test in `momentic app` and then cached. A bare `momentic run` on hand-written
    structured NL steps throws `Cannot target element with no cached data or element
    descriptor`. Use `act:` for runtime AI resolution, or author in `momentic app` first.

## Deterministic login verification

The fixture uses distinct `login-card` and `login-button` IDs. The JavaScript test clicks the button, then waits up to five seconds for a visible dashboard. It also requires the login card to be hidden and the displayed identity to match the entered synthetic email. Preexisting welcome text inside a hidden card cannot satisfy this check. This app simulates sign-in; it does not authenticate an account.

`tests/signin.test.mjs` runs the actual HTML and YAML JavaScript in local Chromium, including a disabled-handler case that must fail. With Playwright Core and a local Chromium available, run:

```bash
PLAYWRIGHT_MODULE_PATH=/absolute/path/to/playwright-core/index.mjs \
CHROME_PATH="/absolute/path/to/Chrome" \
node --test tests/signin.test.mjs
```

Both fixtures route all page requests to local synthetic HTML. They verify DOM behavior, not the Momentic runner, cloud tunnel, or Browserbase integration. Earlier cloud results described above are not revalidated by these local tests.

## Launcher resource ownership

The launcher checks ports 3000 and 8000 with `lsof` before starting resources. If either is occupied, stop its owner yourself and rerun; the launcher never kills a process based on its port. A failed port inspection also stops the run.

Child PIDs and the newly created Browserbase session ID stay in the current shell. Cleanup signals only those owned children still listed as running jobs and requests release only for the current run's validated session ID. Existing `app.pid`, `shim.pid`, `tunnel.pid`, and `bb-session.json` files are neither trusted nor modified. Per-run logs and tunnel metadata use a private temporary directory removed on exit. Cleanup preserves the original exit status.

Run `python3 tests/launcher.test.py` for isolated shell regressions. The fixtures stub process, tunnel, runner, and cloud operations; they verify launcher control flow, not real process termination or remote release acknowledgment.
