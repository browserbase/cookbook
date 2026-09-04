# Sample Organization — Treasury Statement Automation Demo

> **Customer**: Sample Organization (payroll/HR platform, 2,000+ ops team)
> **Use Case**: Automate treasury team's daily bank statement download → upload workflow
> **AE**: Arik Bird | **SE**: Shubhankar

## The Problem

Sample Organization's treasury team manually:
1. Logs into their bank portal (Global Trust Bank)
2. Downloads monthly bank statements (PDFs)
3. Navigates to Sample Organization's internal Treasury Management System
4. Uploads the statements for reconciliation

This happens daily across multiple accounts. With 2,000 people in operations, these repetitive web-based workflows consume enormous resources.

## The Solution

A Browserbase + Stagehand agent that automates the entire flow in ~30 seconds:

```
🏦 Bank Portal          →  📥 Download Statements  →  📤 Upload to TMS  →  ✅ Submitted
(Login + Navigate)         (3 PDF statements)          (Sample Organization Treasury)       (Auto-reconcile)
```

## Demo Architecture

```
demos/sample_org/
├── index.ts              # Main automation script (Stagehand)
├── serve.ts              # Local server for mock portals
├── mock-sites/
│   ├── bank-portal.html  # Mock "Global Trust Bank" portal
│   └── treasury-portal.html  # Mock "Sample Organization TMS" portal
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Quick Start

### 1. Install dependencies

```bash
cd demos/sample_org
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
```

Edit `.env` and add your keys:
- `BROWSERBASE_API_KEY` — Your Browserbase API key (optional for local mode)
- `BROWSERBASE_PROJECT_ID` — Your Browserbase project ID (optional for local mode)
- `MODEL_API_KEY` — Your Google Gemini API key (or OpenAI/Anthropic)

### 3. Run the demo

**Option A: Full auto (recommended)**
```bash
npm start
```
This starts the mock portal server and runs the automation together.

**Option B: Step by step**

Terminal 1 — Start mock portals:
```bash
npm run serve
```

Terminal 2 — Run the automation:
```bash
npm run demo
```

## What Happens During the Demo

### Phase 1: Bank Portal
1. Agent navigates to Global Trust Bank portal
2. Logs in with treasury credentials
3. Extracts account balances (Operations, Payroll, Treasury)
4. Downloads 3 March 2026 bank statements as PDFs

### Phase 2: Treasury Management System
5. Agent navigates to Sample Organization TMS
6. Uploads all 3 downloaded statements
7. Submits for automated reconciliation
8. Confirms successful submission

### Output
The script logs every step with timestamps and provides a final summary:
- Statements downloaded and uploaded
- Time saved vs. manual process
- Scale potential with Browserbase concurrent browsers

## Demo Talking Points

### For Guy (non-technical stakeholder):
- **"Watch the agent work like a human"** — It reads the page, finds the right buttons, fills forms
- **"This is your treasury team's workflow, automated"** — Same steps, zero manual effort
- **"Scale to 2,000 concurrent sessions"** — Process ALL accounts simultaneously with Browserbase
- **"30 seconds vs 15 minutes"** — Per run. At 500 runs/week, that's 125 hours saved weekly

### For Engineering team (if they join):
- **Stagehand's natural language actions** — `page.act("Click the Download PDF button")` — no brittle CSS selectors
- **Structured extraction with Zod** — Type-safe data extraction from any page
- **Browserbase infrastructure** — Stealth mode, proxies, CAPTCHA solving, session recording
- **Drop-in scalability** — Same script runs 1 or 2,000 browsers concurrently

### Competitive advantages to highlight:
- **Stealth & Proxies** — Bank portals have bot detection; Browserbase bypasses it
- **Session Recording** — Every automation run is recorded for compliance/audit (critical for payroll)
- **Concurrent Browsers** — Spin up 2,000 browsers to process ALL workflows simultaneously
- **AI-Powered** — Agent adapts to page changes; no brittle selectors that break

## Customization

### Using with real portals
Replace the mock URLs in `.env`:
```bash
BANK_PORTAL_URL=https://businessbanking.example.com
TREASURY_PORTAL_URL=https://tms.sample_org.com
BANK_USERNAME=real_username
BANK_PASSWORD=real_password
```

### Running on Browserbase (cloud)
The bundled mock portals listen on your computer, so a cloud browser cannot reach
their `localhost` URLs. Host the two mock pages on public HTTPS endpoints or expose
the local server through an authenticated HTTPS tunnel, then configure both URLs:

```bash
BANK_PORTAL_URL=https://your-host.example/bank-portal.html
TREASURY_PORTAL_URL=https://your-host.example/treasury-portal.html
```

Set `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID` only after both portal URLs
are reachable from the internet. Cloud mode rejects loopback, invalid, and non-HTTPS
portal URLs before allocating a browser. Use `npm run demo -- --local` with the
bundled local server.

### Changing the LLM
The demo uses Google Gemini 2.0 Flash by default (fast + cost-effective). To switch:
- Edit `modelName` in `index.ts`
- Set the corresponding API key in `.env`

## Extending for Other Sample Organization Use Cases

This same pattern applies to their other pain points mentioned in the call:

| Use Case | Source | Destination | Volume |
|----------|--------|-------------|--------|
| **Bank Statements** (this demo) | Bank portal | Sample Organization TMS | Daily |
| Government Documents | Internal system | Gov portal | ~500/week |
| Employee Onboarding | HR system | Multiple portals | Continuous |
| Regulatory Submissions | Compliance DB | Gov portals | As needed |
| Payment Processing | Payer data | Merchant portals | Daily |

Each can reuse the same Stagehand patterns: `goto → act → extract → download/upload`.

## Troubleshooting

**Browser doesn't open locally:**
Make sure you have Chrome installed. Stagehand uses Playwright which downloads Chromium, but if it fails:
```bash
npx playwright install chromium
```

**Mock portal not loading:**
Ensure the server is running: `npm run serve`. Check `http://localhost:3000` in your browser.

**Download not working:**
The mock portal generates PDFs in-browser. A run with no completed downloads fails
instead of uploading files left over from an earlier run.

**Stagehand actions failing:**
Try setting `verbose: 2` in the Stagehand constructor for detailed logging. The AI model may need different instructions depending on the page state.
