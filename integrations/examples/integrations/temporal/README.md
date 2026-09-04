# Temporal + Stagehand Integration

A Temporal workflow that searches with Stagehand, retries individual search activities, and reconciles uncertain browser allocation results.

## What it does

- Uses Stagehand to perform Brave searches in a real browser
- Search steps retry against the session identity recorded in workflow history.
- Session creation runs once; an uncertain result triggers metadata reconciliation.

## Temporal Best Practices Demonstrated

### Atomic Activities
Each Temporal activity performs a single, well-defined task:
1. **prepareBrowserExtension / initializeBrowser / reconcileBrowser** - Persist extension setup, create once, and recover uncertain allocation results
2. **navigateToSearchPage** - Navigates to Brave
3. **executeSearch** - Types query and submits search
4. **extractSearchResults** - Extracts and validates results
5. **cleanupBrowser** - Closes browser session
6. **formatResults** - Formats results for display

### Why Atomic Activities?
- **Efficient retries**: If extraction fails after search succeeds, only extraction is retried
- **Better performance**: No need to repeat successful steps
- **Clearer debugging**: Each activity's purpose is obvious
- **Flexible retry policies**: Different activities can have different retry strategies

### Allocation and recovery

`prepareBrowserExtension` uploads the extension bundled with the installed Stagehand version. Temporal records its project and extension IDs before creating a session. The workflow supplies a UUID allocation intent as an activity argument, which is recorded in history.

`initializeBrowser` makes one Browserbase creation request with SDK retries disabled. The session carries the allocation UUID in metadata and has a 30-minute server lifetime. The activity returns the ID directly without opening and closing a browser connection first.

If creation fails or its acknowledgement is lost, `reconcileBrowser` queries that UUID using the [documented metadata syntax](https://docs.browserbase.com/platform/browser/core-features/session-metadata). It adopts one matching running session after validating ownership. Missing or pending results retry for a bounded window. Multiple matching sessions trigger independent release requests and failure. An empty query never authorizes another creation request.

This is reconciliation, not exactly-once creation. Metadata queries have no documented immediate-visibility guarantee. If a session remains undiscoverable, the workflow fails and its server lifetime bounds retention. A lost extension-upload response may also leave an uploaded extension without a recorded ID. The example does not reconcile those uploads.

Allocation and reconciliation run in a non-cancellable scope so a cancellation cannot discard an identity that is about to return. Finally cleanup runs in another non-cancellable scope; a cleanup failure fails the workflow. Provider calls and reconciliation have finite timeouts. Search actions can still be repeated by retries and are not guaranteed idempotent.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in `.env`:
```
BROWSERBASE_API_KEY=your_api_key
BROWSERBASE_PROJECT_ID=your_project_id
OPENAI_API_KEY=your_openai_key # or ANTHROPIC_API_KEY depending on the model you choose
```

3. Start Temporal (if not already running):
```bash
temporal server start-dev
```

## Running the Example

1. Start the worker in one terminal:
```bash
npm run worker
```

2. Run a search in another terminal:
```bash
npm run demo                    # Default search
npm run demo "your search term" # Custom search
```

## How it Works

### Activities (`research-activities.ts`)
Each activity is designed to be:
- **Atomic**: Does one thing only
- **Retry policy**: Read and search steps retry; creation never retries
- **Focused**: Clear single responsibility

### Workflow (`workflows.ts`)
- Orchestrates the atomic activities in sequence
- Uses tailored retry policies for each activity type
- Handles cleanup in a finally block
- Provides clear progress logging

### Worker (`research-worker.ts`)
- Processes workflow tasks
- Limits this worker to two concurrent activity executions. Sessions stay alive between activities, so this setting does not cap open sessions or workflows. Multiple workers each have their own activity limit.
- Simple configuration focused on essentials

## Retry Behavior

Each activity has a custom retry policy based on its characteristics:

- **Prepare extension / initialize browser**: one attempt each; SDK requests have no retries and a 30-second timeout
- **Reconcile allocation**: up to 12 attempts, 2-10 second intervals, with a three-minute overall limit
- **Navigate**: 8 attempts, 1-5 second intervals (fast retries)
- **Execute Search**: 10 attempts, 2-15 second intervals
- **Extract Results**: 10 attempts, 3-20 second intervals (most likely to fail)
- **Cleanup**: 3 attempts, 1-3 second intervals
- **Format**: 2 attempts, minimal retry (deterministic)

## Benefits

- **Simplicity**: Clean code without complex error handling
- **Efficiency**: Only failed steps are retried
- **Reliability**: Temporal ensures tasks complete or fail definitively
- **Visibility**: Monitor progress in Temporal Web UI at http://localhost:8233
- **Maintainability**: Each activity can be tested and updated independently
- **Flexibility**: Easy to add new steps or modify retry behavior

## Local verification

`node --test tests/allocation.test.mjs` exercises actual activity and workflow functions with synthetic provider responses, including lost acknowledgement, delayed visibility, ownership mismatches, duplicates, and cleanup failure. Isolated typechecking used Stagehand 4.0.2, Browserbase SDK 2.19.1, and Temporal 1.23.0. The installed extension archive was resolved through the ESM helper and checked as a ZIP. TypeScript includes that helper in emitted builds.

These checks did not run a Temporal server, create a Browserbase session, or execute a live model/search workflow. They do not establish provider consistency or Temporal history replay behavior.

## Worker shutdown

The worker relies on Temporal's built-in signal handling for SIGINT, SIGTERM, SIGQUIT, and SIGUSR2. It awaits `worker.run()` instead of exiting from a separate signal handler. A two-minute grace period allows in-flight activities to finish, followed by cancellation. A three-minute force deadline rejects the run if it still cannot stop; this fallback does not guarantee cleanup of stuck activities. Failures set exit code 1 without calling `process.exit`.

Stopping a worker is not the same as cancelling a workflow. Workflow history and session identity remain available to a replacement worker. Allocation reconciliation and provider session expiry still matter if the worker cannot finish an activity. The configured activity limit does not provide session admission control.

`node --test tests/shutdown.test.mjs` checks the actual worker entrypoint with a controlled pending run, signal delivery, delayed drain, and startup/run failures. The installed Temporal 1.23 Runtime was separately exercised with SIGINT and a shutdown callback without connecting to a server. Live activity interruption remains unverified. See [Temporal runtime signals](https://typescript.temporal.io/api/interfaces/worker.RuntimeOptions#shutdownsignals) and [worker shutdown options](https://typescript.temporal.io/api/interfaces/worker.WorkerOptions#shutdowngracetime).
