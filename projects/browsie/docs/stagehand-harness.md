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

## Exact action mode

Browsie supports these typed actions:

- `goto`
- `click`
- `fill`
- `type`
- `press`
- `select`
- `wait`

It does not run model-written JavaScript in the Eve process. Snapshot IDs expire after page state
changes, and the next action must use a new snapshot.

Navigation accepts only HTTP and HTTPS URLs without embedded credentials. A destination cannot
change the browser provider. Local fixtures require the operator to set `STAGEHAND_BROWSER=local`;
a localhost URL never switches a hosted session to the application server's local browser.

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
