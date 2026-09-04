# Work App Demo - Quick Start Guide

## Prerequisites

Run `nvm install` and `nvm use` from this package directory before installing dependencies. The selected Node 24 release satisfies Stagehand 4.0.2's declared minimum of Node 22.18.0. A full clean install and live workflow have not been verified with this runtime.

Before running the demo, ensure you have:

- Node.js 24.19.0, selected by `.nvmrc`
- Browserbase account ([sign up](https://browserbase.com))
- Google Gemini API key ([get key](https://aistudio.google.com/apikey))

## Setup (2 minutes)

### 1. Configure Environment Variables

```bash
cd use-cases/sales-support-and-ops/sample-04/demo
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
BROWSERBASE_API_KEY=your_browserbase_api_key_here
BROWSERBASE_PROJECT_ID=your_project_id_here
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
HOST=localhost
```

### 2. Install Dependencies (if not already done)

```bash
npm install
```

### 3. Start the Server

```bash
npm run dev
```

You should see:

```
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║           Work App Automated Testing Demo - Browserbase        ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

✓ Server running at: http://localhost:3000
✓ Target URL: https://work_app.com/signup
✓ Metrics polling: 1500ms
✓ Browserbase project: your_project_id

Press Ctrl+C to stop the server
```

## Running the Demo (30-40 seconds)

### 1. Open Browser

Navigate to: http://localhost:3000

You'll see a three-column layout:
- **Left**: Control panel with "Dispatch Agent" button
- **Center**: Placeholder for live browser view
- **Right**: Metrics panel (all zeros initially)

### 2. Click "Dispatch Agent"

The automation will begin:

**Initialization (5-10s)**
- Creates Browserbase session
- Initializes Stagehand
- Live browser iframe appears

**Navigation (3-5s)**
- Loads Work App signup page
- Page load time tracked
- Metrics start updating every 1.5s

**Form Filling (10-15s)**
- Enters test email (unique timestamp)
- Enters password
- Enters workspace name
- Form fill time tracked

**Submission & Detection (5-8s)**
- Submits form
- AI analyzes result
- Captures screenshot

**Results (instant)**
- Test status: PASSED or FAILED
- Final metrics displayed
- Screenshot saved to `screenshots/`

### 3. Watch the Metrics Panel

During execution, you'll see:

- **Total Tokens**: Increases in real-time
- **Delta Indicator**: Flashes green when tokens increase
- **Inference Time**: AI processing time
- **Operations**: Token breakdown (act, extract, observe)
- **Performance**: Page load, form fill, total time
- **Token Chart**: Real-time visualization

## What You Should See

### Status Log (Left Panel)
```
10:30:15 - Agent dispatched successfully
10:30:17 - Creating Browserbase session...
10:30:20 - Browserbase session created successfully
10:30:21 - Loading Work App signup page...
10:30:23 - Page loaded in 1234ms
10:30:24 - Entering email address...
10:30:26 - Entering password...
10:30:28 - Entering workspace name...
10:30:30 - Submitting signup form...
10:30:33 - Form submitted in 8765ms
10:30:36 - Test PASSED: Email verification required
10:30:37 - Test completed!
```

### Test Results (Bottom of Left Panel)
```
Test Name: Work App Signup Flow Test
Status: PASSED
Duration: 23.4s
Total Tokens: 3,245
Page Load: 1234ms
Form Fill: 8765ms
```

### Metrics Panel (Right)
```
AI Operations
  Total Tokens: 3,245 (+50)
  Inference Time: 12,450ms

Operations
  Act: 2,100 tokens
  Extract: 945 tokens
  Observe: 200 tokens

Performance
  Page Load: 1234ms
  Form Fill Time: 8765ms
  Total Time: 23.4s

[Token Usage Chart showing upward trend]
```

## Troubleshooting

### Server won't start
- Check `.env` file exists and has valid API keys
- Ensure port 3000 is not in use

### Browser iframe doesn't load
- Verify Browserbase API key and project ID
- Check console for initialization errors

### Metrics not updating
- Browser console will show SSE connection status
- Ensure `/api/metrics` endpoint is accessible
- Check server logs for polling errors

### Test fails immediately
- Work App page structure may have changed
- Check server logs for specific error
- Screenshot saved in `screenshots/` directory

## Files to Check

- **Server logs**: Terminal where `npm run dev` is running
- **Browser console**: F12 → Console tab
- **Screenshots**: `screenshots/` directory
- **Status updates**: Left panel in UI

## Demo Script

For live presentations:

1. **Setup**: Start server before demo
2. **Introduction** (30s): Explain the demo purpose
3. **Dispatch** (5s): Click button, show three panels
4. **Watch** (30s): Point out real-time updates
5. **Results** (10s): Show final status and metrics
6. **Q&A**: Answer questions

## Next Steps

- Customize target URL in `src/config.ts`
- Adjust metrics polling interval
- Modify form fields in `src/automation.ts`
- Update branding colors

## Support

See `README.md` for detailed documentation and troubleshooting guide.
