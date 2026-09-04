# Workspace App - House Hunter Agent Demo

A Workspace App-styled web app that uses Browserbase + Stagehand to autonomously browse Zillow and find real estate listings based on natural language queries.

## What it does

1. User types a natural language prompt (e.g., "Find me 3-bedroom houses in San Francisco under $1.5M")
2. Stagehand agent autonomously browses Zillow — navigating, searching, applying filters, scrolling
3. A **live view** of the browser session streams in real-time via Browserbase's debug URL
4. An **agent log** shows each action the agent takes (clicking, typing, scrolling, thinking)
5. Extracted property listings are displayed in a **Workspace App-style database table**

## Demo Context

Workspace App is exploring Browserbase as a browser tool in their agent platform for viewing websites they can't access through other means (Parallel/Exa). Key interests:
- **Live view** of the browser session ("it just looks cool")
- **Screenshot capture** of websites to display in their agent
- Real estate search as an example use case (suggested by Sarah from Workspace App)

## Tech Stack

- **Next.js** (App Router) — frontend + API
- **Stagehand v3** (`@browserbasehq/stagehand`) — AI-powered browser automation agent
- **Browserbase SDK** — cloud browser sessions + live view debug URL
- **Tailwind CSS** — Workspace App-styled UI
- **Server-Sent Events (SSE)** — real-time streaming of agent actions

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys
```

Required keys:
- `BROWSERBASE_API_KEY` — your Browserbase API key
- `BROWSERBASE_PROJECT_ID` — your Browserbase project ID
- `OPENAI_API_KEY` — OpenAI API key (used by Stagehand agent, gpt-4o)

3. Run the dev server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) and type a search query.

## How it works

### Architecture

```
User prompt → Next.js API (SSE stream)
                ↓
        Stagehand.agent() → Browserbase cloud browser
                ↓
        onStepFinish callback → streams actions to frontend
                ↓
        Agent output schema → structured listing data
                ↓
        Results rendered in Workspace App-style table
```

### Key implementation details

- **`stagehand.agent()`** handles the entire browsing flow autonomously — no manual scripted steps
- **`onStepFinish` callback** streams each tool call (act, scroll, keys, extract, think) to the frontend in real-time
- **`output` schema** (Zod) tells the agent what structured data to return when done
- **Browserbase debug URL** (`bb.sessions.debug()`) provides the live view iframe
- Internal tools like `ariaTree` and `screenshot` are filtered out of the user-facing log

### Agent tools visible in the log

| Icon | Tool | Description |
|------|------|-------------|
| 🌐 | goto | Navigating to a URL |
| 🖱 | act | Clicking, typing, interacting with elements |
| ⌨️ | keys | Pressing keyboard keys or typing text |
| 📜 | scroll | Scrolling the page |
| 📊 | extract | Extracting structured data |
| 💭 | think | Agent reasoning/planning |
| ✅ | done | Task complete |

## Configuration

- **Agent model**: Set in `src/app/api/browse/route.ts` — currently `openai/gpt-4o`
- **Browser settings**: Viewport 1280x720, ads blocked, proxy enabled, US West region
- **Max steps**: 30 (configurable in `agent.execute()`)

## Stream completion and retry

The UI distinguishes running, completed, failed and interrupted searches. HTTP failures report the response status without copying a raw error body into the log. A successful HTTP status must carry `text/event-stream` and a readable body. The browser keeps received listings visible as partial results if the search fails or ends early; retry remains available through the submit handler’s `finally` reset.

The route’s final `done` event now includes `outcome: "completed" | "error" | "incomplete"`. Only `completed` followed by a clean stream ending confirms completion. An earlier error event takes precedence over a later completed outcome. A step-limited or otherwise incomplete agent result maps to interrupted, not complete. Missing terminal events, truncated frames and read failures cannot establish success. The terminal log is held until the stream ends; received progress and listing events appear immediately. Completion here means the route’s agent result completed, not independent verification that every listing is accurate or that the browser session remains live.

The client parses UTF-8 SSE across arbitrary chunk boundaries, LF/CRLF line endings, comments and multiline data. It validates consumed event fields, rejects malformed JSON and events after a terminal event, limits each normalized decoded frame to 1 MiB and total wire data to 8 MiB, and cancels/releases the reader when finished or failed. There is no automatic workflow retry or reconnect of this POST stream; an interrupted search requires an explicit user retry.

Run `node --test tests/*.test.mjs` with Node 24. All 41 tests pass locally, covering the actual stream helper, actual submit closure, and actual route-to-client event contract with synthetic provider dependencies. Local React server rendering checks all four outcome labels and partial-result labels. The helper and route also pass an isolated TypeScript check against installed SDK types. These checks do not constitute a fresh full Next.js installation/build or a live Zillow, Browserbase or model run. The original HTTP500 and premature-EOF cases were reproduced before the fix.
