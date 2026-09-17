# this example Portal Migration Workflows

A small, self-contained reference for migrating data out of portals like Platform A and Platform B using
Browserbase + [Stagehand](https://www.stagehand.dev/) agents.

The whole idea: **log in once by hand, then run extractions at volume by editing prompts.**
You don't write browser automation. You describe what you want in plain English in a
`prompt.txt`, and the agent does the navigating and data gathering.

---

## The mental model (two steps)

1. **`npm run portal-login`** — opens a real browser session you log into once. Your login is
   saved into a Browserbase **context** (think: a reusable, authenticated browser profile). The
   context's ID is written to `.env` automatically.

2. **`npm run platform-a/<workflow> -- --volume N`** — spins up *N* browser sessions in parallel, each
   one already logged in (it reuses the saved context, read-only). Each session runs the agent with
   that workflow's prompt, and you get back the extracted data plus a live-view link to watch each run.

That's it. Day-to-day, your job is editing the prompt files under `workflows/`.

---

## Setup

Requires Node 18+.

```bash
npm ci
npm test
cp .env.example .env
```

Fill in `.env`:

| Variable | Where to get it |
|---|---|
| `BROWSERBASE_API_KEY` | https://www.browserbase.com/settings (scopes the org; no project ID needed) |
| `ANTHROPIC_API_KEY` | Model key for the default model (`anthropic/claude-haiku-4-5-20251001`). Set the key matching whatever model's provider you use (`GOOGLE_GENERATIVE_AI_API_KEY` / `OPENAI_API_KEY`). |
| `PLATFORM_A_CONTEXT_ID` / `PLATFORM_B_CONTEXT_ID` | Leave blank — `portal-login:<platform>` sets each one. Per-site so their auth never collides. |

---

## Step 1 — log in once (per site)

```bash
npm run portal-login           # Platform A (default)
npm run portal-login:platform-b    # Platform B
```

This will:
- create a fresh Browserbase context,
- open a browser tab to a live session on that site's login page,
- print step-by-step instructions (sign in, reach the dashboard, press ENTER),
- end the session so your login is **saved into the context**,
- write the site's context var (`PLATFORM_A_CONTEXT_ID` / `PLATFORM_B_CONTEXT_ID`) into `.env`.

> **Why press ENTER to finish?** A context only captures your login when the session *ends*. So
> you log in, then come back to the terminal and press ENTER, which cleanly releases the session
> and flushes your auth into the context. Re-run this anytime that site's login expires.

> **Multiple sites.** Each platform has its own context, so logging into Platform B never disturbs your
> Platform A login. A workflow's site is its folder prefix (`platform-a/…`, `platform-b/…`) and the runner uses
> that site's context automatically. **Adding a new site** = one entry in `src/platforms.ts` (login
> URL + context env var) plus a `workflows/<site>/` folder.

---

## Step 2 — run a workflow at volume

```bash
# one session
npm run platform-a/customer-list

# ten concurrent sessions
npm run platform-a/customer-list -- --volume 10

# tune how many run at once (defaults to the full volume)
npm run platform-a/customer-list -- --volume 10 --concurrency 5

# label a batch to segment its output into results/<label>/ (e.g. comparing models/approaches)
npm run platform-a/customer-list -- --volume 10 --label opus-4.8-vs-haiku
```

Without `--label`, runs land in `results/<DEFAULT_LABEL>/` (set in `src/config.ts`) so experiments
stay separated by default.

The console output is intentionally compact (the full detail goes to the trace files):
- a **start line** per session as it launches — session id, live-view link (open it to watch), and the
  trace path it will write,
- a **finish line** per session as it completes — duration and whether it produced a file,
- a **final summary table** verified against the Browserbase APIs — per session: server status
  (`sessions.retrieve`), duration, and whether a file was captured.

Results are written **per workflow**, into that workflow's own `results/` folder
(e.g. `workflows/platform-a/customer-list/results/`), keyed by session id (no timestamps — the session id
already uniquely identifies a run):
- `<short-session-id>.json` — a full **debug + result trace** per session: outcome, message, token
  usage, download path, step count, and every agent step (each tool call + its truncated result, plus
  any errors). Open this to see exactly what the agent did.
- `<short-session-id>.zip` — anything the agent downloaded, auto-unzipped alongside (see the
  customer-list workflow below).
- `<short-session-id>.output.json` — for typed-output (schema) workflows, the structured result as its
  own deliverable file (e.g. the scraped services list). See `services-list`.

> **Why the `--` ?** npm eats flags before `--`. `npm run platform-a/customer-list --volume 10` would
> *not* pass the flag through. Everything after `--` is forwarded to the script. (Bare, with no
> flag, runs a single session.)

---

## Tuning maxSteps (run → measure → cap → fail-fast + retry)

`maxSteps` is the single most important reliability knob. Too high and a stuck run loops for many
minutes, burning cost and eventually hitting model limits (e.g. Anthropic's 100-image/request cap);
set it just above what real runs need and a stuck run dies in seconds instead. The loop:

1. **Run a batch.** Each trace records the `steps` (agent tool-calls) and `durationMs` it took.
2. **Measure.** `npm run stats platform-a/customer-list` aggregates every run in the workflow's results
   (across labels, or scope with `--label NAME`) and prints, over *passed* runs, the step and
   duration distribution (p50/p90/p95/max) plus a **recommended `maxSteps`** (a margin above p95,
   never below the observed max) next to the current value.
3. **Cap.** Set `maxSteps` in `workflow.json` to the recommendation (just above expected). Runs that
   exceed it fail fast.
4. **Retry.** `failureRetries` (default 2) re-runs any *not-passed* session on a fresh session after
   the batch — the flaky/looped few usually pass on a retry. Override per run with `--retries N`.

A run counts as **passed** if it produced a downloaded file *or* the agent reported success — the
download is the real signal, so a run that got the data but reported an ambiguous status still counts.
Stats accumulate across every run in a label folder, so the picture sharpens as you do more runs.

---

## Writing workflows (the part you actually edit)

A workflow is just a folder under `workflows/`. The only required file is `prompt.txt`.

```
workflows/platform-a/customer-list/
├── prompt.txt      ← the agent instruction. THIS is what you edit.
├── workflow.json   ← optional: { startUrl, maxSteps, model, resultsLabel, excludeTools, navTimeoutMs, agentMaxRetries, failureRetries }
└── schema.ts       ← optional: typed JSON output (see below)
```

- **`prompt.txt`** — plain-English instructions. Be specific about what to collect and when to stop.
- **`workflow.json`** (optional) — overrides defaults:
  - `startUrl` — the page the agent starts on (default: the Platform A dashboard).
  - `maxSteps` — cap on agent steps (default: 25).
  - `model` — model override (default: `anthropic/claude-haiku-4-5-20251001`).
  - `resultsLabel` — name of the results folder for this workflow's runs (`results/<resultsLabel>/`,
    created if missing, appended to if it exists). Precedence: `--label` (CLI) > `resultsLabel` >
    `DEFAULT_LABEL`.
  - `excludeTools` — built-in agent tools to disable, e.g. `["act", "fillForm"]`, to restrict how the
    agent is allowed to interact. Left unset for the current workflows.
  - `navTimeoutMs` — timeout for the initial page load (default: 60000). Raise it for slow portals.
  - `agentMaxRetries` — extra retries (exponential backoff + jitter) when Anthropic returns a
    rate-limit / tokens-per-minute (429) error (default: 8). Lets a big batch ride out the per-minute
    token window instead of giving up.
  - `failureRetries` — extra rounds to re-run any not-passed session after the batch (default: 2).
    Override per run with `--retries N`.
- **`schema.ts`** (optional) — see *Typed output* below.

### Three ways a workflow can produce output

1. **Prompt-only** (default) — the agent returns its result and we store it in the session's
   trace file. Simplest case, just write `prompt.txt`. (See `platform-a/appointments-list`.)

2. **File download** — the prompt drives the portal's own export UI to download a file (e.g. a CSV).
   The runner retrieves whatever the session downloaded into the workflow's `results/` folder. No
   schema needed. **This is what `platform-a/customer-list` does** — see below.

3. **Typed JSON** — add a `schema.ts` that default-exports a Zod object; the runner auto-detects it,
   passes it to the agent as `output`, and the structured result is saved as its own
   `<session-id>.output.json` deliverable (and also embedded in the trace). **`platform-a/services-list`
   does this** — it scrapes the Services page (which has no export button) by scrolling the table and
   returns a typed list. The `_template/schema.ts.example` shows the pattern (rename it to `schema.ts`).

```ts
// workflows/<platform>/<name>/schema.ts
import { z } from "zod";
export default z.object({
  customers: z.array(z.object({
    name: z.string().describe("Customer full name"),
    email: z.string().describe("Email, or empty string if none"),
  })),
});
```

### The `platform-a/customer-list` workflow (CSV export)

Instead of scraping rows one by one, the prompt drives Platform A's own **Import / Export → Export
customers → Download** flow, so the output is Platform A's native CSV export (the complete, authoritative
file). The agent uses Stagehand's built-in browser tools to navigate and click — no custom code; you
just describe the steps in `prompt.txt`.

- `prompt.txt` is the plain-English export procedure — this is the file you tune.
- The CSV is downloaded inside the browser session; the runner retrieves it and writes
  `.../results/<label>/<short-session-id>.zip` (auto-unzipped to the CSV if the system `unzip` is
  available; otherwise the `.zip` is left in place).

> Downloads sync to Browserbase a few seconds after the agent finishes, so the runner polls for the
> file (up to ~60s) before closing the session. That's expected — don't kill the run early.

### Adding a new workflow

1. Copy `workflows/platform-a/_template/` to `workflows/platform-a/<your-workflow>/`.
2. Edit `prompt.txt` (and optionally `workflow.json` / rename `schema.ts.example` to `schema.ts`).
3. Add one line to `package.json` scripts:
   ```json
   "platform-a/<your-workflow>": "tsx scripts/run-workflow.ts platform-a/<your-workflow>"
   ```
4. Run it: `npm run platform-a/<your-workflow> -- --volume 5`

---

## How it's wired (architecture)

```
scripts/portal-login.ts   one-time login → context → CONTEXT_ID in .env
scripts/run-workflow.ts      thin CLI: parses --volume / --concurrency / --label / --retries
scripts/stats.ts             thin CLI for `npm run stats`

src/runner.ts                fans out N sessions, runs the streaming agent, retrieves downloads,
                             records per-session traces, retries not-passed sessions, prints the summary
src/stagehand-session.ts     builds the Stagehand sessions (login: persist+keepAlive; workflow: persist:false)
src/workflow.ts              loads prompt.txt + optional workflow.json + optional schema.ts
src/stats.ts                 aggregates run history → pass rate, step/duration percentiles, recommended maxSteps
src/bb.ts                    Browserbase SDK helpers (context, live-view URL, release, downloads, session status)
src/config.ts               env loading/validation + defaults (model, label, retries, timeouts)
src/{open-url,env-file,logger}.ts   small utilities
```

Things worth knowing:
- **Login persists; workflows don't.** Only `portal-login` writes to the context (`persist: true`).
  Every workflow session reuses it **read-only** (`persist: false`), so concurrent runs can't corrupt
  your saved auth.
- **The agent uses Stagehand's built-in tools** (native Stagehand, no custom CDP) on the default model
  `anthropic/claude-haiku-4-5-20251001` — fast, cheap, and a compact page payload that avoids the
  context/token blowups a raw accessibility-tree dump caused. Set the model per workflow in
  `workflow.json`. Runs **streaming** so the trace captures each step.
- **Residential proxies + Verified Browser Mode** are available (toggled in `src/stagehand-session.ts`,
  off by default). If you enable them, enable both the login and workflow sessions so the saved auth
  replays under a matching fingerprint.
- **Downloads are retrieved before the session closes.** Browserbase syncs them asynchronously, so the
  runner polls and only tears the session down once the file is saved (or it times out).

---

## Notes / limits

- **Concurrency defaults to the full `--volume`** (all sessions at once). Pass `--concurrency N` to
  throttle. Very high volumes are bounded by your Browserbase plan's concurrent-session limit.
- **Model rate limits & runaway runs.** At very high concurrency you can exceed your org's
  per-minute token limit; the runner retries 429s with backoff (`agentMaxRetries`, default 8) and you
  can **throttle with `--concurrency`**. The other failure mode is a run that loops until it hits the
  model's per-request image cap — a tight `maxSteps` (see *Tuning maxSteps*) makes those fail fast and
  retry instead of burning minutes.
- **`keepAlive` sessions** (used by the login flow) require a plan that allows them.
- **`unzip`** is used best-effort to extract the downloaded CSV; if it isn't installed the `.zip` is
  still saved.
- **Workflow status:** `customer-list` (CSV export) and `services-list` (table scrape → typed JSON)
  are wired against the real Platform A test account; `appointments-list` is still a placeholder. For the
  scrape, completeness on the long virtualized table is the thing to validate — check that `count` is
  stable across repeat runs. Remaining work: validate accuracy + runtime at scale and capture token
  usage for the cost story.
