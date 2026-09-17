# Voice Provider + Browserbase

Standalone prototype for a shared Browserbase session controlled by a local Claude-based browser controller, with Voice Provider as the voice shell.

## Required environment variables

Create `.env.local` or `.env` with:

```bash
ANTHROPIC_API_KEY=
BROWSERBASE_API_KEY=
NEXT_PUBLIC_VOICE_PROVIDER_AGENT_ID=
```

Optional:

```bash
BROWSE_BIN=browse
```

## Run locally

```bash
pnpm install
pnpm test
pnpm dev
```

Open:

```text
http://127.0.0.1:3001
```

This adapter supports the npm package **`browse@0.9.6`**. Install that exact version with `npm install -g browse@0.9.6`, or point `BROWSE_BIN` at its executable. A differently named scoped package or another version is not assumed compatible. This is the inspected compatibility version, not a claim that it is the newest published release.

## Voice Provider agent setup

The frontend registers one client tool:

- `control_demo`

Suggested tool description for your Voice Provider agent:

> Use this tool whenever the user asks you to navigate, click, open, read, create, edit, or continue operating the live browser session. Pass one high-level instruction at a time.

Suggested system guidance:

> You are the voice interface for a live Browserbase browser controller. The browser controller owns all navigation, clicking, reading, and page state. Use `control_demo` once for each new browser instruction from the user. After `control_demo` returns `accepted`, `running`, `queued`, or `interrupting`, give at most one short acknowledgement, then wait for controller updates. Never ask "are you there" while the controller is busy. When the controller returns `completed`, answer concisely using the final summary and current page state. When the controller returns `blocked`, ask the clarification once instead of retrying the same tool call.

Do not pass this as a runtime prompt override unless that override is explicitly enabled in the Voice Provider agent settings; otherwise the session may immediately disconnect.

## Controller model

The local controller uses Claude Agent SDK as a step planner pinned to `claude-opus-4-7`, while browser execution runs through the Browserbase `browse` CLI against the same persistent Browserbase session used for the live iframe.

That means the controller plans from `browse snapshot --full` output, clicks by stable refs like `@0-5`, and can follow tab changes through the CLI instead of relying on fuzzy Playwright text matching.

## Status-stream lifecycle checks

The status SSE route releases its subscription, heartbeat and abort listener when the response body is cancelled or the request is aborted. It also cleans up after initialization or serialization/write failure. Already-aborted requests allocate no subscription or timer, and callbacks retained after closure do not enqueue more events.

Run `node --test tests/status-stream.test.mjs` with the recipe's supported Node runtime. These tests execute the actual route with standard Web Streams and synthetic subscriptions/timers, including cancellation without request abort. They verify the route's two lifecycle boundaries; they do not establish how a particular Next.js deployment translates a network disconnect into those signals. No voice connection, microphone, provider call or live demo session is used.

## Voice context synchronization

Each voice connection receives the current relevant blocked, error, queued, or completed controller context. Delivery tracking resets on connect/disconnect. Within a connection, an unchanged successfully sent context is suppressed. Failed sends retry every two seconds while the same context and connection remain active; changing context, disconnecting or unmounting cancels those retries. Late completion from an old connection cannot mark a new connection's context delivered.

“Sent” here means the local SDK call completed without throwing, rejecting, or returning explicit `false`; it is not a remote acknowledgment or proof that the voice agent incorporated the message. The tests support synchronous and asynchronous sender behavior. Run `node --test tests/voice-context.test.mjs` with Node 24 or newer to exercise the actual effect, callbacks and context builder using synthetic senders. These fixtures do not start React, a microphone, or a provider conversation. Full application verification still requires the declared SDK dependency graph to be available under the dependency age policy.

### Corrective interrupts and request retries

`interrupt: true` replaces pending instructions and signals the active run's abort controller, even when the new words overlap the active task or repeat its text. An abort request cannot undo an action already performed; the active loop must observe cancellation before the replacement starts.

The control endpoint accepts an optional UUID `requestId`. Retry the same delivery with the same ID and unchanged instruction/interrupt fields; use a new ID for every new intent, including a correction or intentional repeat. Accepted IDs are remembered in the in-memory demo session. A matching retry does not enqueue or abort again; reusing an ID with changed content raises an error. Background queue dispatch still executes accepted work. This is session-local idempotency, not durable deduplication across server restarts.

The frontend creates a UUID per submission unless one is supplied. The `control_demo` tool can forward an optional `requestId` when its caller needs retry identity; configure that field as an optional UUID string in the voice tool definition. Requests without IDs are treated as new work. Text similarity is not used to discard them.

`tests/controller-interrupt.test.mjs` exercises the actual queue, mutation lock, abort, dispatch and endpoint validation with synthetic session state and real Zod. It covers negated corrections, repeated text, concurrent retries, stale retries after a newer correction, conflicting ID reuse and queued dispatch. Run with Node 24 after installing recipe dependencies:

```bash
node --test tests/controller-interrupt.test.mjs
```

These tests do not verify a live voice call, browser cancellation latency, or the full React/provider dependency graph.

### Direct navigation

A single request such as `open https://example.com/Account?view=Billing#Detail` sends that full URL to the browser. URL parsing normalizes the scheme and hostname while preserving path, query and fragment case and encoding. Bare domains with paths are supported with an HTTPS default. Homepage aliases match an entire site request, such as `open Browserbase homepage`; requesting docs or adding another action goes through the planner. Unknown names are not converted into guessed `.com` domains. Malformed URLs, credentials in URLs, and non-HTTP(S) schemes do not use the shortcut.

`node --test tests/direct-navigation.test.mjs` checks the actual helper and direct-navigation action dispatch with synthetic payloads. This verifies URL selection and forwarding, not destination reachability, redirects or a live browser session.

### Planner completion evidence

Assistant messages are provisional. The controller accepts a decision only from one final `result` with `subtype: success`, `is_error: false`, nonempty result text and no reported early-stop reason. It then validates the JSON against the action schema. Missing or multiple terminal results, SDK error subtypes, stream failures, cancellation and invalid final JSON stop planning; earlier assistant JSON cannot serve as a fallback. The implementation follows the [Agent SDK result contract](https://code.claude.com/docs/en/agent-sdk/typescript).

`node --test tests/planner-result.test.mjs` executes the actual planner with synthetic async message streams and real Zod. These fixtures verify decision acceptance and rejection, not a live model turn or browser action.

### Step-limit outcome

After eight nonterminal browser steps, the controller reports `status: incomplete` and `lastControlOutcome: incomplete`. The heading says the step limit was reached, and the summary and voice update explain that the result remains unconfirmed and ask whether to continue or change the instruction. Exhaustion does not emit a completed outcome, including when earlier browser actions failed. A final-step `done` or `answer` decision still uses the existing completion path.

`node --test tests/step-limit.test.mjs` checks the actual loop and voice builders with synthetic decisions and browser actions. The reconnect tests also cover delivering an unchanged incomplete state to a new voice connection. This does not independently verify a model's completion claim or live speech.

### Controller status freshness

Connection freshness is separate from the task's last status. HTTP errors, network/JSON failures, malformed snapshots and stream errors show a stale-state warning while retaining the last task snapshot for reference. Stale state is not announced to voice as current progress or completion. A valid snapshot for the current demo clears the warning.

Fallback refresh allows one in-flight request, aborts it after ten seconds, and retries every five seconds while stale. Cleanup cancels timers, aborts the request and closes the stream. Valid stream updates advance a revision so an older HTTP response or failure cannot overwrite them. Both stream and HTTP snapshots are checked against the shared client schema and demo ID.

`tests/session-refresh.test.mjs` executes the actual refresh/effect callbacks with synthetic fetch, stream and timers, plus real Zod validation. It covers failures, recovery, races, timeouts and cleanup. This is not a mounted React or live network-disconnect test.

### Browse adapter contract

Before allocating a Browserbase session, `resolveBrowseBinary` resolves the executable and checks its package name/version, declared entrypoint and installed command manifest. It requires named-session/CDP flags for the used commands and full snapshot maps. This reads local metadata without executing the CLI or loading `.env`; it is a compatibility check, not a package-integrity guarantee.

The adapter uses `--cdp` with the existing SDK-created session's connection URL, `tab list` (`tabs` output), `tab switch` with a stable target ID, and `snapshot --full` for `xpathMap`/`urlMap`. Browser commands already emit JSON. It does not use the obsolete `--connect`, `env remote`, `pages`, or `tab_switch` interface. CLI dotenv autoload is disabled, and child-process errors redact the connection URL and configured API keys. Restart the demo server after changing its CLI installation so existing in-memory sessions are recreated with the new connection metadata.

`tests/browse-contract.test.mjs` covers metadata/version/capability rejection, argument construction, pre-allocation failure and error redaction. Set `BROWSE_TEST_BIN` to the installed executable to also check its real manifest and run its tab/snapshot handlers against synthetic managers. The installed `browse@0.9.6` handlers passed these checks; no CLI browser connection, remote session or full voice flow was exercised.
