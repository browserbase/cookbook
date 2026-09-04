# BILL — Human-in-the-Loop Demo

Demonstrates the pause/resume pattern for BILL's agentic bill-pay captcha workflow:

1. **Agent fills a payment form** automatically using Stagehand (PII protected via `variables` — card data never reaches the LLM)
2. **Agent detects a captcha/verification challenge** via `page.extract()`
3. **Agent pauses** and surfaces the moment to a human (in production: a Browserbase live session URL embedded in a Slack message or your app)
4. **Human solves the challenge** in the live browser
5. **Agent resumes** via `page.waitForSelector()`, fills out an accounting metadata form, clicks save, and extracts the final record ID

## Flow

```
[Step 1] Payment form          → Agent fills (5 stagehand actions)
[Step 2] Security verification → 🛑 Agent pauses, human solves
[Step 3] Confirmation + form   → Agent resumes (3 stagehand actions)
[Step 4] Final "All Done"      → Agent extracts record ID
```

The demo includes both halves: real Stagehand `page.act()` actions before AND after the human-in-the-loop step.

## Files

- `portal.html` — Dummy 4-step vendor payment portal (AccuPay)
- `serve.ts` — Tiny HTTP server (port 3000)
- `agent.ts` — Stagehand agent with pause/resume logic
- `package.json` — Dependencies (Stagehand v2, Zod, tsx)

## Run it

```bash
# 1. Install deps (first time only)
npm install
npx playwright install chromium

# 2. In Terminal A: serve the dummy portal
npm run serve

# 3. In Terminal B: run the agent (you solve the captcha)
ANTHROPIC_API_KEY=sk-ant-... npm run agent
```

The browser opens visibly. When the agent hits the verification step it prints a banner and waits — you type the 6-digit code shown on screen and click **Verify**. The agent then resumes automatically.

### Automated test mode (no human needed)

For CI / quick smoke tests, the agent can simulate the human by reading the security code from the DOM:

```bash
SIMULATE_HUMAN=true ANTHROPIC_API_KEY=sk-ant-... npm run agent
```

This is for testing only — a real captcha (reCAPTCHA / hCaptcha) can't be solved this way.

## How this maps to BILL's production flow

In production on Browserbase (cloud), instead of a visible local browser:

1. Get the live session URL: `GET https://api.browserbase.com/v1/sessions/{id}/debug` → returns `debuggerFullscreenUrl`
2. Surface that URL to a human via Slack workflow, email, or embed as an iframe in your app:
   ```html
   <iframe src="{liveViewUrl}"
           sandbox="allow-same-origin allow-scripts"
           allow="clipboard-read; clipboard-write" />
   ```
3. Human solves the captcha through the iframe (full keyboard + mouse interactivity)
4. Agent's `waitForSelector` (or similar signal) detects completion and continues

The live URL can be fetched at any point during an active session, not just at creation.

## Key Stagehand patterns used

- **`page.act({ action, variables })`** — PII-safe action where sensitive values never reach the LLM
- **`page.extract({ instruction, schema })`** — Structured extraction with Zod schemas to detect challenges + pull final data
- **`page.waitForSelector("#confirmation")`** — Clean signal to wait for human completion (no polling needed)

## Notes

- Local mode (`env: "LOCAL"`) — no Browserbase API key required for the demo. The same code works against Browserbase by switching `env: "BROWSERBASE"` and adding `apiKey`/`projectId`.
- The "captcha" in this demo is just a visible 6-digit code, not a real CAPTCHA challenge. The point is to demonstrate the agent's pause/resume mechanism, not captcha solving itself.
