# Stagehand and Eve harness design

Browsie follows the native Eve pattern from the
[Stagehand integration overview](https://docs.stagehand.dev/v4/integrations/overview) and the
[Stagehand Eve integration](https://docs.stagehand.dev/v4/integrations/eve).

```text
Next.js web chat
   │
   ▼
Eve durable model loop
   │
   ├── snapshot ──┐
   ├── run ───────┼── one in-process browser runtime ── one persistent browser
   └── screenshot ┘                         │
                                           ├── Stagehand v4 + local Chrome
                                           └── Stagehand v4 + Browserbase + optional Context
```

## Why Eve

Eve supplies durable sessions, message history, streaming events, skills, hooks, and native tools.
`withEve` mounts the agent and Next.js application on one origin. Browsie does not need a local
HTTP browser service or an MCP process because its three tools and browser runtime run inside Eve.

The direct design gives one useful ownership rule: the Eve session ID owns the browser runtime.
The first browser tool starts it. Later tools and later user turns reuse it. A lifecycle hook saves
the trace after each turn and closes the browser when the Eve session completes or fails.

In hosted mode, Browsie starts the browser with Stagehand's `browserbase.launch` factory. This
factory adds the Stagehand browser extension. Browsie then creates the Stagehand client with
`Stagehand.create`. It saves one Browserbase session ID for each Eve session and uses
`browserbase.connect` to recover that browser after a process restart.

## Why three browser tools

1. `snapshot` reads a compact accessibility tree and gives short-lived target IDs.
2. `run` performs a small batch of exact state changes.
3. `screenshot` supplies visual evidence to the workbench.

The tool result contains two projections. The model sees only the compact browser result. The Eve
event keeps full workbench data, such as traces and the screenshot. This keeps large UI data out of
the model context while the chat can still explain how the task ran.

## Official `run` contract

Browsie implements the shared Stagehand v4 agent-framework contract. `run` accepts exactly one of:

- `code`: JavaScript with Playwright-shaped `page`, `context`, and `browser` objects in scope.
- `actions`: snapshot-ID operations for `click`, `hover`, `fill`, `type`, `press`, and `select`.

Use code for navigation, multi-step logic, waits, and extraction. Use actions for simple operations
on elements in the latest snapshot. Each action uses `op` and `id`. Snapshot IDs expire after the
page changes, and the next action must use a new snapshot.

The model-authored JavaScript does not run in the Eve or Next.js process. Browsie uses Stagehand's
callback batch and the official Playwright compatibility runtime, so the code runs in the
Stagehand browser extension service worker. The browser session is still privileged: code can
reach any data that is available in that session. Browserbase is the isolation boundary.

The compatibility runtime is vendored from
`browserbase/stagehand/packages/integrations/core/src/facade/runtime.ts` because the shared
integration core is not a public package export. The source revision is recorded at the top of
`server/stagehand-facade-runtime.ts` so a maintainer can compare and update it.

## Hosted session settings

The Browserbase adapter requests `proxies: true`, `keepAlive: true`, and
`browserSettings.verified: true` for every new session. An optional Browserbase Context uses
`persist: true`. A connection error causes a new verified, proxied session attempt. It never causes
a weaker hosted session.

## How other harnesses map to the contract

| Harness       | Stagehand connection                  | Browsie lesson                                        |
| ------------- | ------------------------------------- | ----------------------------------------------------- |
| Eve           | Native tools in one durable app       | Browsie's current design.                             |
| Claude Code   | Agent SDK with one MCP process        | Expose the same three tools through MCP.              |
| Codex         | Codex SDK thread with one MCP process | Keep the browser client alive for the thread.         |
| CrewAI        | Python with MCP                       | Add a screenshot-file projection for text-only paths. |
| Deep Agents   | Local MCP or managed tools            | Bind one browser to one managed thread.               |
| Mastra        | One MCP client around the model loop  | Do not create a client for each tool call.            |
| fx            | MCP tools                             | Check discovery and screenshot frame limits.          |
| Pi            | Native extension tools                | Keep lazy browser start.                              |
| Vercel AI SDK | Model loop with one MCP process       | Use this when Eve durability is not needed.           |

The complete source list is in the [Stagehand v4 documentation map](stagehand-v4-doc-map.md).
