# Treasury statement transfer example

This specific use-case example downloads synthetic bank statements from a mock portal and uploads them to a mock treasury system for reconciliation. It demonstrates a document-transfer workflow using only synthetic accounts.

> Demo and reference code only. The bundled portals and records are synthetic. Review authentication, authorization, retention, and payment boundaries before adapting it.

## Quick Start

### 1. Install dependencies

```bash
cd demos/example
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
```

Edit `.env` and add your keys:
- `BROWSERBASE_API_KEY` — Your Browserbase API key (optional for local mode)
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
5. Agent navigates to Example treasury system
6. Uploads all 3 downloaded statements
7. Submits for automated reconciliation
8. Confirms successful submission

### Output
The script logs every step with timestamps and provides a final summary:
- Statements downloaded and uploaded
- Time saved vs. manual process
- Scale potential with Browserbase concurrent browsers

## Design notes

- Keep bank and treasury credentials in a local ignored environment file.
- Validate downloaded files before upload and confirm the destination explicitly.
- Use session recordings only under an approved retention policy.

## Customization

### Using with real portals
Replace the mock URLs in `.env`:
```bash
BANK_PORTAL_URL=https://businessbanking.example.com
TREASURY_PORTAL_URL=https://treasury.example.invalid
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

Set `BROWSERBASE_API_KEY` only after both portal URLs
are reachable from the internet. Cloud mode rejects loopback, invalid, and non-HTTPS
portal URLs before allocating a browser. Use `npm run demo -- --local` with the
bundled local server.

### Changing the LLM
The demo uses Google Gemini 2.0 Flash by default (fast + cost-effective). To switch:
- Edit `modelName` in `index.ts`
- Set the corresponding API key in `.env`

## Related use cases

The same pattern can be adapted to other authorized document-transfer workflows:

| Use Case | Source | Destination | Volume |
|----------|--------|-------------|--------|
| **Bank Statements** (this demo) | Bank portal | Example treasury system | Daily |
| Government Documents | Back-office system | Gov portal | ~500/week |
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
