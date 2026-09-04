# Spend Workflow Bill Automation — Claude Code Instructions

You are helping build **self-healing bill-pull and bill-pay automations** for telecom portals (AT&T, T-Mobile, Verizon, and more). You have access to a Browserbase cloud browser via the `bb-browse` CLI.

## Your Job

When asked to create an automation for a portal, you should:

1. **Open the portal** in the Browserbase browser and explore it yourself
2. **Figure out** the login flow, navigation, and where billing info lives
3. **Generate a PortalDefinition JSON file** that captures what you learned
4. **Save it** to `portals/<id>.json`

**IMPORTANT RULES:**
- ALWAYS use the `bb-browse` CLI to interact with web pages. Do NOT write Stagehand scripts, Playwright scripts, or any other code to control the browser.
- `bb-browse` uses **Browserbase cloud browsers** (with proxies, stealth mode, CAPTCHA solving). It does NOT use local Chrome.
- You are NOT writing CSS selectors. You are writing **natural-language instructions** that Stagehand AI will execute at runtime. This makes the automation self-healing.

## Browser CLI — `bb-browse`

The browser CLI lives at `scripts/bb-browse.ts`. Run it with `npx tsx`:

```bash
npx tsx scripts/bb-browse.ts navigate <url>          # Go to a page
npx tsx scripts/bb-browse.ts act "<instruction>"     # Click, type, scroll, etc.
npx tsx scripts/bb-browse.ts extract "<instruction>" # Pull structured data
npx tsx scripts/bb-browse.ts observe "<query>"       # See interactive elements
npx tsx scripts/bb-browse.ts screenshot              # Capture the current page
npx tsx scripts/bb-browse.ts close                   # End and release the session
```

### How sessions work

- **First command** creates a new Browserbase session with `keepAlive: true` and saves the session ID to `.bb-session.json`.
- **Subsequent commands** reattach to the same session via the Browserbase debug WebSocket URL. This means page state (cookies, login, navigation) persists across commands.
- Sessions auto-expire after 15 minutes of inactivity.
- Run `close` to explicitly release a session when done exploring.
- If a session expires mid-exploration, the next command auto-creates a fresh one.

### Key implementation details (if you need to debug)

- The CLI uses Browserbase SDK to create sessions, NOT Stagehand's `env: "BROWSERBASE"` mode.
- It connects Stagehand with `env: "LOCAL"` + `localBrowserLaunchOptions.cdpUrl` pointing to the Browserbase WebSocket URL.
- It does NOT call `stagehand.close()` — that would kill the remote session. Instead it just exits the process, letting the CDP connection drop while the session stays alive.
- Reattach works via `bb.sessions.debug(sessionId)` which returns a fresh `wsUrl`.

## How to Explore a Portal

Here's the general approach — **use your judgment**, every portal is different:

1. `npx tsx scripts/bb-browse.ts navigate <login-url>` — go to the portal
2. Read the screenshot — see what the page looks like
3. `npx tsx scripts/bb-browse.ts observe "login form elements"` — discover what's on the page
4. Try the login flow step by step (enter username, click next, enter password, etc.)
5. Read each screenshot after every action to see what changed
6. Look for billing/account sections — explore the navigation
7. Find where the balance and due date are displayed
8. `npx tsx scripts/bb-browse.ts extract "..."` — test extracting the balance data
9. If the portal has a payment flow, explore that too
10. `npx tsx scripts/bb-browse.ts close` — release the session when done

**Take screenshots after every action.** The CLI automatically screenshots after each command. Read the screenshot file to see what the page looks like.

**Be creative.** If you can't find the billing page through the nav, try direct URLs like `/billing` or `/account/balance`. If the login is multi-step, figure that out.

**Watch for gotchas discovered in previous explorations:**
- T-Mobile requires 10-digit phone number WITHOUT country code (e.g. `6282797091` not `+16282797091`). The Next button stays gray/disabled until valid input.
- T-Mobile has a 3-step login: (1) phone/email → Next, (2) choose "Log in with password" (not Face ID), (3) enter password → Log in.
- Some portals show cookie banners, promo popups, or "download our app" interstitials. Add steps to dismiss them.

## Portal Definition Format

After exploring, save a JSON file to `portals/<id>.json` with this structure:

```json
{
  "id": "tmobile",
  "name": "T-Mobile",
  "loginUrl": "https://account.t-mobile.com/signin/v2/",
  "notes": "Optional notes about quirks discovered during exploration",
  "billPullSteps": [
    {
      "description": "What this step does (for logging)",
      "action": "navigate | act | extract | observe | screenshot | wait",
      "instruction": "Natural language instruction for Stagehand",
      "schema": { "balance": "number", "due_date": "string" },
      "isFinalResult": true,
      "waitMs": 3000
    }
  ],
  "billPaySteps": [ ... ],
  "mfaDetection": {
    "observeInstruction": "What to look for to detect MFA",
    "indicators": ["verification code", "6-digit code", "confirm it's you", ...]
  }
}
```

### Step actions:
- **navigate** — `instruction` is the URL to go to
- **act** — `instruction` is what to do, e.g. `"Type \"{{username}}\" into the email field"`
- **extract** — `instruction` describes what data to pull. Add `schema` for structured output and `isFinalResult: true` if this is the data we need.
- **observe** — `instruction` is what to look for (used for MFA detection)
- **wait** — pauses execution. Set `waitMs` for how long.
- **screenshot** — captures the current page (no instruction needed)

### Template variables (replaced at runtime):
- `{{username}}` — the user's login username
- `{{password}}` — the user's login password
- `{{mfa_code}}` — the MFA verification code (provided via PATCH API)
- `{{payment_amount}}` — bill pay amount in dollars
- `{{account_number}}` — ACH account number
- `{{routing_number}}` — ACH routing number

## MFA Detection

Telecom portals almost always have MFA. After the login steps, add an `observe` step that looks for MFA prompts. List common indicator phrases in the `mfaDetection.indicators` array. The job runner will:
1. Detect MFA indicators in the observe result
2. Set job status to `mfa_requested`
3. Pause and wait for the code via `PATCH /job/:id`
4. Resume execution with `{{mfa_code}}` replaced in subsequent steps

## Running the Deterministic Job Runner

After generating a portal definition, test it with the job runner:

```bash
# Start the API server
npm run dev

# Submit a job
curl -s -X POST http://localhost:3000/job \
  -H "Content-Type: application/json" \
  -d '{"job_id":"test-001","type":"bill_pull","username":"...","password":"...","portal":"tmobile"}'

# Poll status (watch for mfa_requested)
curl -s http://localhost:3000/job/test-001

# Submit MFA code when requested
curl -s -X PATCH http://localhost:3000/job/test-001 \
  -H "Content-Type: application/json" \
  -d '{"mfa_code":"123456"}'
```

The `session_id` in the response links to the Browserbase dashboard where you can watch the live session or replay it for debugging.

## Tips

- **Be specific in your instructions.** "Click the magenta Next button below the email input" is better than "click next"
- **Handle the unexpected.** Portals might show cookie banners, promo popups, or "download our app" interstitials. Add steps to dismiss them.
- **Test your extractions.** When you find the billing page, try `bb-browse extract` to make sure you can actually pull the balance and due date.
- **Note what you learn.** If a portal has a quirky flow, capture that in the `notes` field and in step descriptions.
- **Use the `observe` command** to discover interactive elements when you're not sure what's on the page. It returns element descriptions with their roles.

## What This Project Does

The portal definitions you generate are used by the **Job Runner** (`src/job-runner.ts`) which:
1. Receives job requests from Spend Workflow's Testing Service via the Standard Job API
2. Loads the portal definition for the requested portal
3. Creates a Browserbase session (with keepAlive, CAPTCHA solving, stealth)
4. Connects Stagehand via the session's WebSocket URL
5. Executes each step using Stagehand's AI
6. Detects MFA and pauses for code via API
7. Returns the extracted bill data (balance + due date) or payment confirmation

The key value prop: **You (Claude Code) do the hard work of exploring the portal once. Then Stagehand replays your instructions reliably at scale, self-healing when the UI changes.**
