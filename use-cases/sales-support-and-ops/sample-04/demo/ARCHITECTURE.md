# Work App Demo - Architecture Details

## Overview

This document explains the technical architecture of the Work App automated testing demo, highlighting key design decisions and implementation details.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │   Control    │  │  Live Browser    │  │   Metrics Panel      │  │
│  │    Panel     │  │     (iframe)     │  │  • Token Counter     │  │
│  │ • Dispatch   │  │  Browserbase     │  │  • Delta Indicators  │  │
│  │ • Status Log │  │  Session View    │  │  • Performance       │  │
│  │ • Results    │  │                  │  │  • Token Chart       │  │
│  └──────┬───────┘  └────────┬─────────┘  └─────────┬────────────┘  │
│         │                   │                        │               │
│         │          SSE #1: Status Updates            │               │
│         └────────────────────┼──────────────────────┘               │
│                              │                                       │
│                     SSE #2: Metrics (1.5s polling)                   │
│                              │                                       │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────────┐
│                      Express Server (Backend)                        │
├──────────────────────────────┼───────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     API Endpoints                              │ │
│  │  POST /api/start  │  GET /api/status  │  GET /api/metrics    │ │
│  │  GET /api/health  │  Static: /public                          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                               │                                      │
│  ┌────────────────────────────┴──────────────────────────────────┐  │
│  │           Work AppTestAutomation Class                         │  │
│  │  • Stagehand Instance                                         │  │
│  │  • Metrics Polling (setInterval 1.5s)                         │  │
│  │  • Status Callback → broadcastStatus()                        │  │
│  │  • Metrics Callback → broadcastMetrics()                      │  │
│  │  • Custom Performance Timers                                  │  │
│  └───────────────────────────┬───────────────────────────────────┘  │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────────┐
│                         Browserbase                                  │
├──────────────────────────────┼───────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │               Remote Browser Session                          │ │
│  │  • Stagehand Controls (act, extract, observe)                 │ │
│  │  • AI Model (ie gemini-2.0-flash-exp)                     │ │
│  │  • Live View iframe URL                                       │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Dual SSE Architecture

**Why Dual SSE?**
- Workflow status and metrics have different update frequencies
- Status updates are event-driven (state changes)
- Metrics need regular polling (every 1.5 seconds)
- Keeps concerns separated and prevents interference

**Implementation:**
```typescript
// Server maintains two client arrays
const sseStatusClients: Response[] = [];
const sseMetricsClients: Response[] = [];

// Status updates broadcast on state changes
function broadcastStatus(state: WorkflowState): void {
  const data = `data: ${JSON.stringify(state)}\n\n`;
  sseStatusClients.forEach(client => client.write(data));
}

// Metrics broadcast every 1.5s from polling interval
function broadcastMetrics(metrics: MetricsSnapshot): void {
  const data = `data: ${JSON.stringify(metrics)}\n\n`;
  sseMetricsClients.forEach(client => client.write(data));
}
```

### 2. Metrics Polling System

**Why Polling?**
- Stagehand doesn't provide real-time metrics streaming
- `stagehand.metrics` is a getter, not an event emitter
- Need to poll at regular intervals to track changes

**Implementation:**
```typescript
async startMetricsPolling(): Promise<void> {
  this.metricsPoller = setInterval(async () => {
    if (!this.stagehand) return;

    try {
      const rawMetrics = await this.stagehand.metrics;

      // Calculate totals from prompt + completion tokens
      const totalTokens = rawMetrics.totalPromptTokens +
                         rawMetrics.totalCompletionTokens;

      // Calculate deltas from last snapshot
      const deltaTokens = this.lastMetricsSnapshot
        ? totalTokens - (this.lastMetricsSnapshot.totalPromptTokens +
                        this.lastMetricsSnapshot.totalCompletionTokens)
        : totalTokens;

      // Broadcast to all connected clients
      if (this.metricsCallback) {
        this.metricsCallback({ /* metrics snapshot */ });
      }

      // Store for next delta calculation
      this.lastMetricsSnapshot = rawMetrics;
    } catch (error) {
      console.warn('Failed to collect metrics:', error);
    }
  }, 1500); // Poll every 1.5 seconds
}
```

**Critical Details:**
- Must start AFTER Stagehand initialization
- Must stop in `finally` block to prevent memory leaks
- Stores last snapshot for delta calculation
- Catches errors gracefully (metrics can fail mid-run)

### 3. Stagehand Metrics Structure

**Actual Stagehand Type:**
```typescript
interface StagehandMetrics {
  actPromptTokens: number;
  actCompletionTokens: number;
  actInferenceTimeMs: number;
  extractPromptTokens: number;
  extractCompletionTokens: number;
  extractInferenceTimeMs: number;
  observePromptTokens: number;
  observeCompletionTokens: number;
  observeInferenceTimeMs: number;
  agentPromptTokens: number;
  agentCompletionTokens: number;
  agentInferenceTimeMs: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalInferenceTimeMs: number;
}
```

**Our Transformed Structure:**
```typescript
interface MetricsSnapshot {
  timestamp: string;
  stagehandMetrics: {
    totalTokens: number;           // prompt + completion
    totalInferenceTimeMs: number;
    operationBreakdown: {
      act: { tokens: number; timeMs: number };
      extract: { tokens: number; timeMs: number };
      observe: { tokens: number; timeMs: number };
    };
  };
  customMetrics: {
    pageLoadTime: number;
    formFillTime: number;
    totalExecutionTime: number;
  };
  deltaTokens: number;
  deltaTimeMs: number;
}
```

### 4. Custom Performance Timing

**Why performance.now()?**
- Higher precision than Date.now()
- Sub-millisecond accuracy
- Not affected by system clock changes

**Implementation:**
```typescript
async navigateToSignup(): Promise<void> {
  const startTime = performance.now();

  await this.stagehand.page.goto(config.automation.targetUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  const endTime = performance.now();
  this.customTimers.set('pageLoad', endTime - startTime);

  this.emitStatus('navigating',
    `Page loaded in ${(endTime - startTime).toFixed(0)}ms`);
}
```

**Tracked Metrics:**
- `pageLoad`: Time to load Work App signup page
- `formFill`: Time to fill all form fields and submit
- `totalExecutionTime`: Date.now() - startTime (full workflow)

### 5. Test Result Detection

**Challenge:**
- Work App may show success message OR error message
- Page structure can vary
- Need intelligent detection

**Solution: Stagehand Extract with Zod Schema**
```typescript
const pageState = await this.stagehand.page.extract({
  instruction:
    'Determine if the signup was successful or if there was an error. ' +
    'Look for success messages like "verify your email" or ' +
    'error messages like "email already exists". ' +
    'Return {success: true/false, message: "description"}',
  schema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
});
```

**Fallback Strategy:**
```typescript
// If extraction fails, check URL
const currentUrl = this.stagehand.page.url();
result = {
  success: !currentUrl.includes('signup'),
  message: currentUrl.includes('signup')
    ? 'Still on signup page'
    : 'Navigated away',
  screenshotPath: await this.captureScreenshot('test-result'),
  timestamp: new Date().toISOString(),
};
```

### 6. Three-Column Responsive Layout

**Grid Strategy:**
```css
.container {
  display: grid;
  grid-template-columns: 30% 45% 25%;
  gap: 1rem;
}

/* Tablet */
@media (max-width: 1400px) {
  .container {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto;
  }
  .control-panel { grid-column: 1 / -1; }
}

/* Mobile */
@media (max-width: 900px) {
  .container {
    grid-template-columns: 1fr;
  }
}
```

**Dynamic Session Visibility:**
```javascript
// Hide browser view until session starts
const container = document.querySelector('.container');
container.classList.add('no-session'); // Initially 2 columns

// Show when session created
container.classList.remove('no-session'); // Expands to 3 columns
```

## Data Flow

### 1. Test Dispatch Flow

```
User clicks "Dispatch Agent"
  ↓
POST /api/start
  ↓
new Work AppTestAutomation(statusCb, metricsCb)
  ↓
automation.run()
  ├─→ initialize()
  │   └─→ Create Browserbase session
  │       └─→ emit status: 'initializing'
  │           └─→ broadcastStatus() → SSE clients
  │
  ├─→ startMetricsPolling()
  │   └─→ setInterval(1500ms)
  │       └─→ poll stagehand.metrics
  │           └─→ broadcastMetrics() → SSE clients
  │
  ├─→ navigateToSignup()
  │   ├─→ performance.now() start
  │   ├─→ stagehand.page.goto()
  │   ├─→ performance.now() end
  │   └─→ emit status: 'navigating'
  │
  ├─→ fillSignupForm()
  │   ├─→ performance.now() start
  │   ├─→ act('Enter email')
  │   ├─→ act('Enter password')
  │   ├─→ act('Enter workspace')
  │   ├─→ act('Click submit')
  │   ├─→ performance.now() end
  │   └─→ emit status updates
  │
  ├─→ detectTestResult()
  │   ├─→ extract(instruction, schema)
  │   ├─→ captureScreenshot()
  │   └─→ emit status: 'validating_result'
  │
  └─→ stopMetricsPolling()
      └─→ emit status: 'completed'
          └─→ broadcast final metrics
```

### 2. Metrics Update Flow

```
setInterval(1500ms)
  ↓
Poll stagehand.metrics
  ↓
Calculate totals
  totalTokens = promptTokens + completionTokens
  ↓
Calculate deltas
  deltaTokens = currentTotal - lastSnapshotTotal
  ↓
Build MetricsSnapshot
  {
    stagehandMetrics: { ... },
    customMetrics: { ... },
    deltaTokens,
    deltaTimeMs
  }
  ↓
broadcastMetrics(snapshot)
  ↓
SSE → metricsEventSource.onmessage
  ↓
updateMetricsUI(metrics)
  ├─→ Update token counter
  ├─→ Flash delta indicator
  ├─→ Update operation breakdown
  ├─→ Update performance metrics
  └─→ Update token chart
```

### 3. UI Update Flow

```
SSE Events Arrive
  ↓
┌─────────────────┬──────────────────┐
│ Status Event    │ Metrics Event    │
├─────────────────┼──────────────────┤
│ updateStatusUI  │ updateMetricsUI  │
│   ↓             │   ↓              │
│ addStatusEntry  │ Update counters  │
│ Scroll log      │ Flash deltas     │
│ Show iframe     │ Update chart     │
│ Show results    │ Update breakdown │
└─────────────────┴──────────────────┘
```

## Critical Implementation Notes

### 1. Polling Lifecycle Management

**Must Start After Init:**
```typescript
async run(): Promise<WorkflowResult> {
  try {
    await this.initialize();      // Create Stagehand
    await this.startMetricsPolling(); // THEN start polling
    // ...
  }
}
```

**Must Stop in Finally:**
```typescript
finally {
  this.stopMetricsPolling(); // Prevent memory leak
  if (this.stagehand) {
    await this.stagehand.close();
  }
}
```

### 2. Delta Calculation

**Why Store Last Snapshot?**
- Can't recalculate from zero each time
- Deltas show rate of token consumption
- Visual feedback for UI (flash animations)

**Implementation:**
```typescript
const deltaTokens = this.lastMetricsSnapshot
  ? totalTokens - lastTotalTokens  // Show difference
  : totalTokens;                   // First snapshot

this.lastMetricsSnapshot = rawMetrics; // Store for next time
```

### 3. Unique Email Generation

**Why Timestamp?**
- Work App rejects duplicate emails
- Each test run needs unique email
- Timestamp ensures uniqueness

```typescript
await this.stagehand.page.act({
  action: `Enter "test-${Date.now()}@example.com" in the email field`,
});
```

### 4. Screenshot Directory

**Auto-Creation:**
```typescript
// In automation.ts
const path = `screenshots/${name}-${Date.now()}.png`;
await this.stagehand.page.screenshot({ path, fullPage: true });
```

**Directory must exist:**
```bash
mkdir -p screenshots
```

### 5. SSE Reconnection

**Client-Side Auto-Reconnect:**
```javascript
statusEventSource.onerror = (error) => {
  console.error('Status SSE error:', error);
  addStatusUpdate('Connection lost, attempting to reconnect...', false, true);
  setTimeout(() => connectStatusSSE(), 3000); // Retry in 3s
};
```

## Performance Considerations

### 1. Polling Interval Trade-offs

**1.5 seconds chosen because:**
- Fast enough for "real-time" feel
- Not too aggressive (no server overload)
- Matches human perception threshold
- Allows for visual delta animations

**Can adjust in config:**
```typescript
automation: {
  metricsPollingInterval: 1500, // Change to 1000 for faster, 3000 for slower
}
```

### 2. SSE Client Cleanup

**Prevents Memory Leaks:**
```typescript
req.on('close', () => {
  const index = sseStatusClients.indexOf(res);
  if (index !== -1) {
    sseStatusClients.splice(index, 1);
  }
});
```

### 3. Chart History Limit

**Prevents Array Growth:**
```javascript
metricsHistory.push({ timestamp, tokens });
if (metricsHistory.length > 60) {
  metricsHistory.shift(); // Keep last 60 data points
}
```

## Security Considerations

### 1. Environment Variables

**Never commit .env:**
```gitignore
.env
.env.local
```

**Use .env.example:**
```env
BROWSERBASE_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
```

### 2. CORS Headers

**SSE Endpoints:**
```typescript
res.setHeader('Access-Control-Allow-Origin', '*');
```

**Production Note:** Replace `*` with specific origin

### 3. Rate Limiting

**Consider adding:**
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10 // 10 requests per minute
});

app.use('/api/start', limiter);
```

## Extensibility

### Adding New Metrics

1. **Add to MetricsSnapshot type:**
```typescript
customMetrics: {
  pageLoadTime: number;
  formFillTime: number;
  newMetric: number; // Add here
}
```

2. **Track in automation:**
```typescript
this.customTimers.set('newMetric', value);
```

3. **Update UI:**
```html
<div class="metric-card">
  <div class="metric-label">New Metric</div>
  <div class="metric-value" id="new-metric">0</div>
</div>
```

```javascript
document.getElementById('new-metric').textContent =
  `${metrics.customMetrics.newMetric}`;
```

### Changing Target Application

1. **Update config:**
```typescript
automation: {
  targetUrl: 'https://your-app.com/signup',
}
```

2. **Update form actions:**
```typescript
await this.stagehand.page.act({
  action: 'Enter username in the username field',
});
```

3. **Update detection logic:**
```typescript
const pageState = await this.stagehand.page.extract({
  instruction: 'Look for your app success indicators...',
  schema: z.object({ success: z.boolean(), message: z.string() }),
});
```

## Conclusion

This architecture provides:
- **Real-time visibility** into AI operations
- **Separation of concerns** (status vs metrics)
- **Robust error handling** at all levels
- **Performance tracking** with custom timers
- **Extensibility** for new features

The dual SSE design is the key innovation, allowing independent streams for different data types while maintaining real-time updates for users.
