# Work App Automated Testing Demo

An end-to-end automated testing demonstration showcasing AI-powered browser automation with real-time metrics streaming. This demo tests Work App's signup flow using Browserbase and Stagehand, displaying comprehensive performance and AI operation metrics in real-time.

## Features

- **Fully Automated Testing**: No human-in-the-loop - complete end-to-end test automation
- **Real-Time Metrics Streaming**: Dual SSE streams for workflow status and AI metrics
- **Live Browser View**: Watch the test execute in real-time via Browserbase iframe
- **Performance Tracking**: Custom timers for page load and form fill operations
- **AI Operation Analytics**: Track token usage, inference time, and operation breakdown
- **Visual Metrics Dashboard**: Real-time charts and counters with delta indicators

## Architecture

### Three-Column Layout

```
┌─────────────────────────────────────────────────────────────┐
│                    Header & Branding                        │
├──────────────────┬──────────────────────┬───────────────────┤
│  Control Panel   │   Live Browser View  │   Metrics Panel   │
│      (30%)       │        (45%)         │       (25%)       │
│                  │                      │                   │
│  • Dispatch Btn  │  Browserbase iframe  │  • AI Operations  │
│  • Status Log    │  (embedded session)  │  • Performance    │
│  • Test Results  │                      │  • Token Chart    │
└──────────────────┴──────────────────────┴───────────────────┘
```

### Backend Components

- **Express Server**: Hosts frontend and API endpoints
- **Dual SSE Streams**:
  - `/api/status` - Workflow state updates
  - `/api/metrics` - Real-time AI metrics (polled every 1.5s)
- **Work AppTestAutomation**: Main automation class with metrics polling

### Workflow Steps

1. Initialize Browserbase session with Stagehand
2. Navigate to Work App signup page (track page load time)
3. Fill signup form with test data (track form fill time)
4. Submit form and wait for result
5. Extract success/failure state using AI
6. Capture screenshot and display results

## Prerequisites

Run `nvm install` and `nvm use` from this package directory before installing dependencies. The selected Node 24 release satisfies Stagehand 4.0.2's declared minimum of Node 22.18.0. A full clean install and live workflow have not been verified with this runtime.

- Node.js 24.19.0 and npm, selected by `.nvmrc`
- Browserbase account with API key and Project ID
- Gemini API key (for Stagehand AI operations)

## Installation

1. From the cookbook root, open the demo directory:
```bash
cd use-cases/sales-support-and-ops/sample-04/demo
```

2. Install dependencies:
```bash
npm install
```

3. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

4. Edit `.env` with your credentials:
```env
BROWSERBASE_API_KEY=your_browserbase_api_key
BROWSERBASE_PROJECT_ID=your_browserbase_project_id
GEMINI_API_KEY=your_gemini_api_key
PORT=3000
HOST=localhost
```Fcli

## Usage

### Start the Server

```bash
npm run dev
```

The server will start at `http://localhost:3000`

### Run the Test

1. Open `http://localhost:3000` in your browser
2. Click the **"Dispatch Agent"** button
3. Watch the automation in three panels:
   - **Left**: Status updates and test results
   - **Center**: Live browser session
   - **Right**: Real-time metrics and charts

### What Happens During the Test

1. **Initialization** (5-10s)
   - Creates Browserbase session
   - Initializes Stagehand with Gemini
   - Connects SSE streams

2. **Navigation** (3-5s)
   - Loads Work App signup page
   - Tracks page load time
   - Starts metrics polling

3. **Form Filling** (10-15s)
   - Enters unique test email
   - Enters password
   - Enters workspace name
   - Tracks form fill time

4. **Submission & Detection** (5-8s)
   - Submits signup form
   - Waits for page response
   - Extracts result using AI

5. **Results** (instant)
   - Displays PASSED/FAILED status
   - Shows final metrics
   - Captures screenshot

**Total Time**: ~25-40 seconds

## Metrics Explained

### AI Operations

- **Total Tokens**: Cumulative tokens consumed by AI operations
- **Inference Time**: Total AI processing time in milliseconds
- **Operations Breakdown**:
  - **Act**: Browser actions (click, type, etc.)
  - **Extract**: Data extraction from page
  - **Observe**: Page state observations

### Performance

- **Page Load**: Time to load Work App signup page
- **Form Fill Time**: Time to complete all form fields
- **Total Time**: Complete test execution time

### Token Usage Chart

Real-time line chart showing token consumption over time, updated every 1.5 seconds.

## API Endpoints

### `POST /api/start`

Start a new test run.

**Response:**
```json
{
  "success": true,
  "message": "Test started successfully"
}
```

### `GET /api/status`

Server-Sent Events stream for workflow status updates.

**Event Data:**
```json
{
  "stage": "filling_email",
  "message": "Entering email address...",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "metadata": {
    "sessionId": "...",
    "sessionUrl": "https://www.browserbase.com/sessions/..."
  }
}
```

### `GET /api/metrics`

Server-Sent Events stream for real-time metrics.

**Event Data:**
```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "stagehandMetrics": {
    "totalTokensUsed": 1250,
    "totalInferenceTime": 3450,
    "operationBreakdown": {
      "act": { "count": 4, "tokens": 800, "time": 2000 },
      "extract": { "count": 1, "tokens": 300, "time": 1200 },
      "observe": { "count": 2, "tokens": 150, "time": 250 }
    }
  },
  "customMetrics": {
    "pageLoadTime": 1234,
    "formFillTime": 8765,
    "totalExecutionTime": 23456
  },
  "deltaTokens": 50,
  "deltaTime": 250
}
```

### `GET /api/health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "isRunning": false,
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

## Project Structure

```
work_app/
├── src/
│   ├── server.ts           # Express server with dual SSE
│   ├── automation.ts       # Work AppTestAutomation class
│   ├── config.ts           # Configuration and validation
│   └── types.ts            # TypeScript types and Zod schemas
├── public/
│   └── index.html          # Three-column frontend UI
├── screenshots/            # Auto-generated test screenshots
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── .env.example            # Environment variable template
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## Customization

### Change Target URL

Edit `src/config.ts`:
```typescript
automation: {
  targetUrl: 'https://your-app.com/signup',
  // ...
}
```

### Adjust Metrics Polling Interval

Edit `src/config.ts`:
```typescript
automation: {
  metricsPollingInterval: 2000, // 2 seconds
  // ...
}
```

### Customize Branding

Edit `src/config.ts`:
```typescript
branding: {
  colors: {
    primary: '#yourcolor',
    secondary: '#yourcolor',
    // ...
  }
}
```

## Troubleshooting

### Test Fails Immediately

**Cause**: Missing or invalid environment variables

**Solution**: Verify `.env` file contains valid API keys:
```bash
cat .env
```

### Browser Iframe Doesn't Load

**Cause**: Browserbase session creation failed

**Solution**: Check console logs for initialization errors:
```bash
npm run dev
# Look for "Initialization failed" messages
```

### Metrics Not Updating

**Cause**: Metrics polling not started or Stagehand not initialized

**Solution**:
- Check browser console for SSE connection errors
- Verify `/api/metrics` endpoint is accessible
- Ensure metrics polling starts after initialization

### Form Fields Not Found

**Cause**: Work App page structure changed

**Solution**: Update form field instructions in `src/automation.ts`:
```typescript
await this.stagehand.page.act({
  action: 'Updated instruction to find email field',
});
```

### Screenshot Directory Missing

**Cause**: `screenshots/` directory doesn't exist

**Solution**:
```bash
mkdir screenshots
```

## Demo Script

### For Live Demonstrations

1. **Setup** (before demo):
   - Start server: `npm run dev`
   - Open browser to `http://localhost:3000`
   - Verify all environment variables are set

2. **Introduction** (30s):
   - "This demo showcases fully automated testing of Work App's signup flow"
   - "We'll see real-time AI metrics, live browser automation, and test results"

3. **Dispatch Agent** (5s):
   - Click "Dispatch Agent" button
   - Point out three-column layout

4. **Watch Execution** (30s):
   - **Left panel**: Status updates showing workflow progress
   - **Center**: Live browser view of Work App signup
   - **Right**: Metrics updating every 1.5 seconds

5. **Highlight Metrics** (15s):
   - Token usage increasing in real-time
   - Delta indicators flashing on updates
   - Operation breakdown (act, extract, observe)
   - Performance timings appearing

6. **Results** (10s):
   - Test completes with PASSED/FAILED status
   - Final metrics displayed
   - Screenshot captured in `screenshots/` directory

7. **Q&A**: Common topics:
   - How metrics polling works (setInterval + stagehand.metrics)
   - Dual SSE architecture for status + metrics
   - Custom performance timing with performance.now()
   - Test detection using Stagehand extraction

## Technical Notes

### Metrics Polling Implementation

Metrics are polled every 1.5 seconds using `setInterval`:
```typescript
this.metricsPoller = setInterval(async () => {
  const currentMetrics = await this.stagehand.metrics;
  // Calculate deltas and broadcast
}, 1500);
```

### Delta Calculation

Deltas are calculated by storing the last snapshot:
```typescript
const deltaTokens = this.lastMetricsSnapshot
  ? currentMetrics.totalTokensUsed - this.lastMetricsSnapshot.totalTokensUsed
  : currentMetrics.totalTokensUsed;
```

### Performance Timing

Uses `performance.now()` for sub-millisecond accuracy:
```typescript
const startTime = performance.now();
// ... operation ...
const endTime = performance.now();
this.customTimers.set('operationName', endTime - startTime);
```

### Test Detection

Uses Stagehand's `extract()` with a Zod schema:
```typescript
const pageState = await this.stagehand.page.extract({
  instruction: 'Determine if signup was successful...',
  schema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
});
```

## License

MIT

## Support

For issues or questions:
- Check troubleshooting section above
- Review console logs for error messages
- Verify environment variables are set correctly
- Ensure Browserbase and Gemini API keys are valid

## Production build

Install this recipe’s dependencies with the repository’s seven-day release-age policy, then run `npm run build` and `npm start`. The build removes stale `dist` output, compiles TypeScript to `dist/src`, and copies the current `public/index.html` to `dist/public`. A compilation failure removes partial output. Local ESM imports include `.js` so Node can execute the compiled files.

Deploy `dist`, `package.json`, and this recipe’s installed runtime dependencies together. Supply the documented environment variables to the server process. Source files, private runtime data, and static-file backups are not required in the artifact.

Locally checked with installed dependency runtimes: a clean build, removal of stale output, and a separate artifact serving `/`, `/index.html`, and `/api/health` with synthetic configuration. Source and backup paths return 404. This does not verify a fresh dependency installation or the live onboarding workflow.

## Metrics contract

The metrics stream reports `null` for unmeasured values, rendered as an em dash. Zero is a measured duration, not a substitute for missing data. `domInteractiveTime` is the document navigation entry’s DOM-interactive milestone in milliseconds since navigation start; it is not an application readiness or Time to Interactive measurement. `postSubmitWaitTime` measures the deliberate three-second post-submit wait, not an observed redirect. These fields replace `timeToInteractive` and `redirectTime` in the SSE payload.

Page URL, title, navigation status, and observed errors are collected in one evaluation of one active page. `statusCode` comes from `PerformanceNavigationTiming.responseStatus`; zero, unsupported or unavailable status becomes `null`. It describes the current document response, including an HTTP error response, not SPA route health or all subrequests.

Before the workflow’s first navigation, an initialization script installs current-document listeners for runtime errors, resource errors, and unhandled promise rejections. `errors` contains only those category names, capped at 100, with `errorsTruncated` indicating overflow. Messages, stack traces and failed resource URLs are not included. `errorCoverage: "document-start"` means this document has the collector; `errors: []` means no events observed so far. An uninstrumented page reports `errorCoverage: "unavailable"`, `errors: null` and `errorsTruncated: null`. Navigation resets observations. This does not capture handled exceptions, console errors, previous documents, or a combined history across child frames or new tabs. It does not establish that the application is healthy or login succeeded.

Run `node --test tests/page-health.test.mjs` on Node 24 for the retained contract tests. To include local browser checks, point `PLAYWRIGHT_MODULE_PATH` at an already installed `playwright-core` and optionally set `CHROME_EXECUTABLE_PATH` (defaults to system Chrome on macOS). The browser suite explicitly skips if these are unavailable and never downloads a browser. All 21 tests passed locally with Chrome, covering loopback HTTP 200/404/redirects, runtime/resource/rejection events, bounds and reset, absent instrumentation, actual broadcaster forwarding, and UI unknown/zero rendering. The collector runs in a real browser; broadcaster/UI checks use the actual source with synthetic dependencies. This does not verify Stagehand RPC instrumentation or the live login workflow. The production build and standalone server smoke also pass using the existing dependency runtime described above.

## Reconnecting to a run

`POST /api/start` returns a `runId`. The server keeps the latest run’s snapshot in memory, including its `revision`, `isRunning`, workflow stage, session metadata and result. `GET /api/status` sends that snapshot immediately on every SSE subscription; `GET /api/run` returns the same snapshot as JSON. This is snapshot reconciliation, not a replay of every progress message. Reconnecting or reloading does not start another workflow.

A terminal workflow callback can arrive while cleanup is still running. The snapshot remains `isRunning: true` and additional starts return HTTP 409 until the run promise settles. The UI uses that flag to reconcile the dispatch button, including idle snapshots, and deduplicates repeated log/result rendering by run ID and revision. Native EventSource reconnection receives the latest snapshot. A completed test with `taskPreview.status: "FAILED"` remains a completed failed test; execution or cleanup failures use stage `error` and retain any available test result. Raw thrown exception text is replaced with a generic run error.

Only the latest run is retained. Starting the next run replaces the previous snapshot; stopping or restarting the server clears it. This provides recovery from a client disconnect, not durable history or recovery across server restarts. Keep this demo private: retained session metadata and test results are exposed to clients that can reach its endpoints.

With this recipe’s dependencies installed, run `node --test tests/run-state.test.mjs tests/reconnect.test.mjs` on Node 24. `EXPRESS_MODULE_PATH` can select an existing Express installation for isolated verification. Ten store tests and four actual HTTP/UI contract tests pass, including disconnected completion for both test outcomes, concurrent-start rejection through cleanup, execution failure and repeated snapshot reconciliation. HTTP tests use the actual server routes and Express with synthetic automation; UI tests execute the actual update function with synthetic DOM dependencies. No login, model or Browserbase call is made. Together with the page-health suite, all 35 tests pass locally.
