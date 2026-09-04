# Retailer AI Shopping Agent Demo

**Browserbase + Stagehand** demo that searches Retailer and adds a reported recommendation to a cart.

## What it does

1. Opens Retailer in a Browserbase browser.
2. Runs the configured shopping task through the agent.
3. Requires a successful, complete result with a nonempty product and cart confirmation before reporting Done.

## Quick Start

```bash
# Install dependencies
npm install

# Copy env and add your keys
cp .env.example .env

# Run the demo
npm run demo
```

## Configuration

Set these in `.env`:

```
BROWSERBASE_API_KEY=...
BROWSERBASE_PROJECT_ID=...
OPENAI_API_KEY=...
```

## Output

The CLI prints the validated agent result and a Browserbase session replay link.

## Session Replays

Every run creates Browserbase session recordings you can review at:
```
https://www.browserbase.com/sessions/{session_id}
```

## Architecture

```
src/
└── demo.ts           # Main workflow and result validation
```

## Completion and cleanup

The demo prints Done only after the helper reports both success and completion, the result passes the output schema, a nonempty product is reported added to the cart, and cleanup finishes. Missing recommendations, missing output, an incomplete task, or an unsuccessful cart result causes a nonzero exit. These checks validate the agent report; they do not independently verify the retailer cart.

The launched browser is owned before Stagehand setup. Stagehand and browser cleanup are attempted independently after setup, navigation, task, or output failures. Cleanup errors are reported with the original error when both occur.

`npm test` runs the actual CLI logic in synthetic subprocesses with the installed Zod schema and mocked browser/agent boundaries. It covers success, incomplete and invalid output, setup/navigation/model failures, and independent cleanup failures. It never calls the retailer or adds an item to a real cart.
