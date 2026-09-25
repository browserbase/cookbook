# convex-stagehand

AI-powered browser automation for Convex applications. Extract data, perform actions, and automate workflows using natural language - no Playwright knowledge required.

## Features

- **Simple API** - Describe what you want in plain English
- **Type-safe** - Full TypeScript support with Zod schemas
- **Session management** - Reuse browser sessions across multiple operations
- **Agent mode** - Autonomous multi-step task execution
- **Powered by Stagehand** - Uses the [Stagehand](https://github.com/browserbase/stagehand) v4 SDK

Read [MIGRATION.md](MIGRATION.md) before upgrading an existing deployment. Configure Node 24 and externalize the Stagehand package using this repository's `convex.json`.

## Quick Start

### 1. Build and install this cookbook version

This checkout contains unpublished Stagehand v4 changes. Installing `@browserbasehq/convex-stagehand` from the registry does not establish that you received these changes, even when the version number matches. Use the local tarball for the implementation documented here; no registry release is implied.

From the cookbook root, with Node 24:

```bash
cd integrations/packages/convex-stagehand
npm ci
npm run build
mkdir -p artifacts
npm pack --ignore-scripts --pack-destination artifacts
```

For the bundled example, the verified local consumer path is:

```bash
cd example
npm install
```

This installs the `file:..` dependency against the parent you just built. Continue with the [example deployment setup](./example/README.md#2-configure-convex) when ready to use your own account.

For another Convex application, the generated tarball avoids registry/source ambiguity. Its fresh dependency resolution is currently subject to the release-age limit described below. In that application's directory, install the generated tarball. Replace the absolute path below with the location of your cookbook checkout:

```bash
npm install /absolute/path/to/cookbook/integrations/packages/convex-stagehand/artifacts/browserbasehq-convex-stagehand-0.1.1.tgz zod@4.4.3
```

Packing is local and does not publish a package. The tarball contains compiled `dist` exports and the component source. Rebuild and repack after editing the component. Dependency installations must respect your environment's package release-age policy; do not bypass it to reproduce this checkout. During the September 6, 2026 verification, clean locked component installation/build and the local example installation passed. A separate tarball consumer install was blocked by the seven-day cutoff for `@ai-sdk/anthropic@4.0.49`; tarball installation into a fresh unrelated app is not yet verified.

### 2. Configure Convex

Add this `convex.json` in your application's project root (the directory where you run the Convex CLI):

```json
{
  "node": {
    "externalPackages": ["@browserbasehq/stagehand"],
    "nodeVersion": "24"
  }
}
```

Then add the component to your `convex/convex.config.ts`:

```typescript
import { defineApp } from "convex/server";
import stagehand from "@browserbasehq/convex-stagehand/convex.config";

const app = defineApp();
app.use(stagehand, { name: "stagehand" });

export default app;
```

### 3. Set Up Environment Variables

Add these to your [Convex Dashboard](https://dashboard.convex.dev) → Settings → Environment Variables:

| Variable | Description |
|----------|-------------|
| `BROWSERBASE_API_KEY` | Your Browserbase API key |
| `MODEL_API_KEY` | Your LLM provider API key (OpenAI, Anthropic, etc.) |

### 4. Use the Component

```typescript
import { action } from "./_generated/server";
import { Stagehand } from "@browserbasehq/convex-stagehand";
import { components } from "./_generated/api";
import { z } from "zod";

const stagehand = new Stagehand(components.stagehand, {
  browserbaseApiKey: process.env.BROWSERBASE_API_KEY!,
  modelApiKey: process.env.MODEL_API_KEY!,
});

export const scrapeHackerNews = action({
  handler: async (ctx) => {
    return await stagehand.extract(ctx, {
      url: "https://news.ycombinator.com",
      instruction: "Extract the top 5 stories with title, score, and link",
      schema: z.object({
        stories: z.array(z.object({
          title: z.string(),
          score: z.string(),
          link: z.string(),
        }))
      })
    });
  }
});
```

## API Reference

### `startSession(ctx, args)`

Start a new browser session. Returns session info for use with other operations.

```typescript
const session = await stagehand.startSession(ctx, {
  url: "https://example.com",
  browserbaseSessionID: "optional-existing-session-id",
  options: {
    timeout: 30000,
    waitUntil: "networkidle",
    domSettleTimeoutMs: 2000,
    selfHeal: true,
    systemPrompt: "Custom system prompt for the session",
  }
});
// { sessionId: "...", cdpUrl: "wss://..." }
```

**Parameters:**
- `url` - The URL to navigate to
- `browserbaseSessionID` - Optional: Resume an existing Browserbase session
- `options.timeout` - Navigation timeout in milliseconds
- `options.waitUntil` - When to consider navigation complete: `"load"`, `"domcontentloaded"`, or `"networkidle"`
- `options.domSettleTimeoutMs` - Timeout for DOM to settle before considering page loaded
- `options.selfHeal` - Enable self-healing capabilities for more robust automation
- `options.systemPrompt` - Custom system prompt to guide the AI's behavior during the session

**Returns:**
```typescript
{
  sessionId: string; // Use with other operations
  cdpUrl?: string;   // For advanced Playwright/Puppeteer usage
}
```

---

### `endSession(ctx, args)`

End a browser session.

```typescript
await stagehand.endSession(ctx, { sessionId: session.sessionId });
```

**Parameters:**
- `sessionId` - The session to end

**Returns:** `{ success: boolean }`

---

### `extract(ctx, args)`

Extract structured data from a web page using AI.

```typescript
// Without session (creates and destroys its own)
const data = await stagehand.extract(ctx, {
  url: "https://example.com",
  instruction: "Extract all product names and prices",
  schema: z.object({
    products: z.array(z.object({
      name: z.string(),
      price: z.string(),
    }))
  }),
});

// With existing session (reuses session, doesn't end it)
const data = await stagehand.extract(ctx, {
  sessionId: session.sessionId,
  instruction: "Extract all product names and prices",
  schema: z.object({ ... }),
});
```

**Parameters:**
- `sessionId` - Optional: Use an existing session
- `url` - The URL to navigate to before the operation, including when reusing a session (required if no sessionId). Omit it to keep an existing session on its current page
- `instruction` - Natural language description of what to extract
- `schema` - Zod schema defining the expected output structure
- `options.timeout` - Navigation timeout in milliseconds
- `options.waitUntil` - When to consider navigation complete: `"load"`, `"domcontentloaded"`, or `"networkidle"`

**Returns:** Data matching your Zod schema

---

### `act(ctx, args)`

Execute browser actions using natural language.

```typescript
// Without session
const result = await stagehand.act(ctx, {
  url: "https://example.com/login",
  action: "Click the login button and wait for the page to load",
});

// With existing session
const result = await stagehand.act(ctx, {
  sessionId: session.sessionId,
  action: "Fill in the email field with 'user@example.com'",
});
```

**Parameters:**
- `sessionId` - Optional: Use an existing session
- `url` - The URL to navigate to before the operation, including when reusing a session (required if no sessionId). Omit it to keep an existing session on its current page
- `action` - Natural language description of the action to perform
- `options.timeout` - Navigation timeout in milliseconds
- `options.waitUntil` - When to consider navigation complete

**Returns:**
```typescript
{
  success: boolean;
  message: string;
  actionDescription: string;
}
```

---

### `observe(ctx, args)`

Find available actions on a web page.

```typescript
const actions = await stagehand.observe(ctx, {
  url: "https://example.com",
  instruction: "Find all clickable navigation links",
});
// [{ description: "Home link", selector: "a.nav-home", method: "click" }, ...]
```

**Parameters:**
- `sessionId` - Optional: Use an existing session
- `url` - The URL to navigate to before the operation, including when reusing a session (required if no sessionId). Omit it to keep an existing session on its current page
- `instruction` - Natural language description of what actions to find
- `options.timeout` - Navigation timeout in milliseconds
- `options.waitUntil` - When to consider navigation complete

**Returns:**
```typescript
Array<{
  description: string;
  selector: string;
  method: string;
  arguments?: string[];
}>
```

---

### `agent(ctx, args)`

Execute autonomous multi-step browser automation using an AI agent. The agent interprets the instruction and decides what actions to take.

```typescript
// Agent creates its own session
const result = await stagehand.agent(ctx, {
  url: "https://google.com",
  instruction: "Search for 'convex database' and extract the top 3 results with title and URL",
  options: { maxSteps: 10 },
});

// Agent with existing session
const result = await stagehand.agent(ctx, {
  sessionId: session.sessionId,
  instruction: "Fill out the contact form and submit",
  options: { maxSteps: 5 },
});
```

**Parameters:**
- `sessionId` - Optional: Use an existing session
- `url` - The URL to navigate to before the operation, including when reusing a session (required if no sessionId). Omit it to keep an existing session on its current page
- `instruction` - Natural language description of the task to complete
- `options.cua` - Enable Computer Use Agent mode
- `options.maxSteps` - Maximum steps the agent can take
- `options.systemPrompt` - Custom system prompt for the agent
- `options.timeout` - Navigation timeout in milliseconds
- `options.waitUntil` - When to consider navigation complete

**Returns:**
```typescript
{
  actions: Array<{
    type: string;
    action?: string;
    reasoning?: string;
    timeMs?: number;
  }>;
  completed: boolean;
  message: string;
  success: boolean;
}
```

## Examples

### Simple extraction (automatic session)

```typescript
const news = await stagehand.extract(ctx, {
  url: "https://news.ycombinator.com",
  instruction: "Get the top 10 stories with title, points, and comment count",
  schema: z.object({
    stories: z.array(z.object({
      title: z.string(),
      points: z.string(),
      comments: z.string(),
    }))
  })
});
```

### Manual session management

Use session management when you need to perform multiple operations while preserving browser state (cookies, login, etc.):

```typescript
// Start a session
const session = await stagehand.startSession(ctx, {
  url: "https://google.com"
});

// Perform multiple operations in the same session
await stagehand.act(ctx, {
  sessionId: session.sessionId,
  action: "Search for 'convex database'"
});

const data = await stagehand.extract(ctx, {
  sessionId: session.sessionId,
  instruction: "Extract the top 3 results",
  schema: z.object({
    results: z.array(z.object({
      title: z.string(),
      url: z.string(),
    }))
  })
});

// End the session when done
await stagehand.endSession(ctx, { sessionId: session.sessionId });
```

### Autonomous agent

Let the AI agent figure out how to complete a complex task:

```typescript
const result = await stagehand.agent(ctx, {
  url: "https://www.google.com",
  instruction: "Search for 'best pizza in NYC', click on the first result, and extract the restaurant name and address",
  options: { maxSteps: 10 }
});

console.log(result.message); // Summary of what the agent did
console.log(result.actions); // Detailed log of each action taken
```

### Resume session across Convex actions

Store the `sessionId` to continue working with the same Stagehand session across different Convex action calls:

```typescript
// Action 1: Start session and return sessionId
export const startBrowsing = action({
  handler: async (ctx) => {
    const session = await stagehand.startSession(ctx, {
      url: "https://example.com/login"
    });
    // Store sessionId in your database
    return session.sessionId;
  }
});

// Action 2: Continue same session later
export const continueBrowsing = action({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    await stagehand.act(ctx, {
      sessionId: args.sessionId,
      action: "Navigate to the dashboard page",
    });

    return await stagehand.extract(ctx, {
      sessionId: args.sessionId,
      instruction: "Extract user data",
      schema: z.object({ ... }),
    });
  }
});
```

## Configuration Options

### AI Model

By default, the component uses `openai/gpt-4o`. You can use any model supported by the [Vercel AI SDK](https://sdk.vercel.ai/providers/ai-sdk-providers) that supports structured outputs:

```typescript
const stagehand = new Stagehand(components.stagehand, {
  browserbaseApiKey: process.env.BROWSERBASE_API_KEY!,
  modelApiKey: process.env.ANTHROPIC_API_KEY!, // Use Anthropic
  modelName: "anthropic/claude-3-5-sonnet-20241022",
});
```

For the full list of supported models and providers, see the [Stagehand Models documentation](https://docs.stagehand.dev/configuration/models).

## Requirements

- [Browserbase](https://browserbase.com) account and API key
- LLM provider API key (see [supported models](https://docs.stagehand.dev/configuration/models))
- Convex 1.45.0 or later, Node 24

## How It Works

This component uses the [Stagehand v4 SDK](https://docs.stagehand.dev) in Convex Node actions. See [migration and validation notes](MIGRATION.md) for configuration and unsupported v3 options. Each operation:

1. Starts a cloud browser session via Browserbase (or reuses an existing one)
2. Navigates to the target URL
3. Uses AI to understand the page and perform the requested operation
4. Optionally ends the session and returns results

With session management, you control when sessions start and end, allowing you to maintain browser state across multiple operations.

## Development

### Component Structure

The component exposes its API through Convex's component system. All functions are in a single `lib.ts` module:

```
component.lib.<function>
```

For example:
- `component.lib.startSession` - Start a browser session
- `component.lib.endSession` - End a browser session
- `component.lib.extract` - Extract data from web pages
- `component.lib.act` - Perform browser actions
- `component.lib.observe` - Find interactive elements
- `component.lib.agent` - Autonomous multi-step automation

The `Stagehand` client class wraps these internal paths to provide a clean user API:

```typescript
// User calls:
stagehand.extract(ctx, {...})

// Internally calls:
ctx.runAction(component.lib.extract, {...})
```

### Building the Component

The local build consumes the generated component files already checked into this cookbook. It does not require a deployment:

```bash
npm ci
npm run build
npm test
```

`npm run build:codegen` is a separate maintainer workflow that invokes the Convex CLI. It may need configured deployment access and is not required for the local tarball above.

### Example App

Follow the [example setup](./example/README.md). Build the parent package before installing the example's `file:..` dependency:

```bash
# From this component directory
npm ci
npm run build
cd example
npm install
```

The example has its own `convex.json`. Running `npm run dev` from there starts Convex deployment setup and generates the example's API/server types; that step requires your own account and configuration.

The example includes:
- HackerNews story extraction with AI
- Type-safe data extraction using Zod schemas
- Database persistence with Convex
- Real-time updates and automatic refresh

## License

MIT


### Stagehand v4 option boundary

The component separates browser launch/reconnect options from Stagehand creation options. It forwards `model`, `domSettleTimeoutMs`, `selfHeal` and `systemPrompt` through the real Stagehand schema. Legacy `verbose` values 0/1/2 map to logging levels off/info/debug; `experimental: true` is rejected explicitly. Invalid Stagehand configuration fails before allocating a browser. Browser session IDs and region options never enter Stagehand's strict creation schema.

Adapter tests preserve the installed schema and create branded browser handles with Stagehand's factory over a synthetic WebSocket. A Convex test action exercises the real component payload and metadata calls, with browser/model behavior mocked. This does not validate live provider behavior. The example application separately requires its generated Convex files for full typechecking.

### Settings across session reconnections

`startSession` stores the effective `domSettleTimeoutMs`, `selfHeal`, `systemPrompt`, `verbose`, and `experimental` browser settings in the component's session metadata. Startup navigation and later `extract`, `act`, `observe`, and `agent` browser connections use those settings, including explicit `false` and `0` values. Stored settings take precedence over a later client's constructor defaults. Create a new session to change them. Unsupported `experimental: true` still fails before allocation.

Older sessions without stored settings use the configuration supplied with each operation. Temporary sessions store their settings for consistent initialization and navigation. Ending a session preserves its metadata; apply your application's retention policy to these records. Prompts are stored as application data, so do not put credentials in them.

Browserbase credentials and model configuration are supplied per operation and are not stored in session settings. The agent task's `options.systemPrompt` controls its tool-loop instruction separately from the persisted Stagehand browser prompt. Local Convex tests exercise storage, immediate navigation, all four reconnecting operations, and compatibility with older records using real Stagehand schema validation over a synthetic browser. This does not establish a live deployment result.


### Navigation when reusing a session

For `extract`, `act`, `observe`, and `agent`, an explicit `url` navigates the selected session before executing the operation. This also applies when `sessionId` is supplied. Omitting `url` preserves the current page in a reused session. A navigation failure prevents the operation; caller-owned sessions stay open, while automatically allocated sessions follow the cleanup path.

The navigation regression tests execute the component handlers with a synthetic lower API and cover all four operations, including region-routing retries. They do not access a live page or establish full Convex/Stagehand SDK compatibility. Run `node --test tests/navigation.test.mjs` with Node 24 from this package directory.

### Failed automatic cleanup and release retries

Ordinary `extract`, `act`, `observe`, and `agent` results keep their existing shapes. If releasing an automatically owned session fails, the action throws a structured Convex application error instead of reporting ordinary success. Use the exported `getSessionCleanupFailure(error)` helper to recognize it:

```ts
import { getSessionCleanupFailure } from "@browserbasehq/convex-stagehand";

try {
  return await stagehand.extract(ctx, options);
} catch (error) {
  const failure = getSessionCleanupFailure(error);
  if (!failure) throw error;
  // failure.sessionId identifies the owned session whose release failed.
  // If operationSucceeded is true, result contains its completed output.
  // Avoid repeating the browser operation just to retry cleanup.
  throw error;
}
```

`cleanupState: "pending"` means a credential-free retry record was saved. `"unrecorded"` means saving that record also failed: retain the session ID and explicitly retry `stagehand.endSession(ctx, { sessionId })` with your configured client, checking its `success` result. When the browser operation itself failed, the cleanup error has `operationSucceeded: false` and no fabricated result. Operation output in an application error is intentionally available to the caller; handle it according to your application's data policy.

Call `await stagehand.reconcileCleanup(ctx, { limit: 25 })` from an application action to retry due cleanup for the client's configured Browserbase project. The limit is 1–100. The result reports `attempted`, `releaseRequested`, `pending`, and `unrecorded` counts for that batch. An `unrecorded` count means release bookkeeping failed; a retained lease expires so a later invocation can retry. It is not a claim that no queue record exists.

Pending records contain session/project IDs, region, attempt count, due time, and lease state. They contain no API keys, model credentials, browser output, or CDP URL. Claims use a two-minute lease; release calls have a 30-second timeout with SDK retries disabled. Failed releases use increasing retry delays capped at one hour. Records marked `release_requested` remain available for inspection; this example does not automatically delete that history.

For continuing recovery, add an **internal action in your application** that constructs the configured client from server-side environment variables and calls `reconcileCleanup`. Schedule that internal action using your application's Convex cron configuration with empty arguments. This package does not install a cron or schedule credentials. Deploy the updated component schema and generated bindings before enabling the retry caller.

`releaseRequested` and `release_requested` mean Browserbase accepted the release request. They do not prove terminal browser shutdown or that billing has stopped. Caller-owned sessions are never automatically released or queued by these four operations.

The cleanup tests include real Convex schema/transaction tests for queue isolation, concurrent claims, expired leases, stale tokens, and backoff, plus actual component/client control flow with synthetic provider responses. No live Convex deployment or Browserbase release was executed. Run the tests with Node 24, setting `COOKBOOK_CONVEX_VALUES_MODULE` to the installed Convex values module and, for an isolated runtime, `COOKBOOK_CONVEX_RUNTIME` to the directory containing its `package.json` and dependencies:

```sh
node --test tests/*.test.mjs
```
