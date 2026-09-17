# external job orchestrator Bill Automation — Self-Healing Web Automation Demo

> **For external job orchestrator's Self-Healing Web Automation head-to-head evaluation.**
> Powered by [Browserbase](https://browserbase.com) + [Stagehand](https://stagehand.dev) + [Claude Code](https://claude.com/claude-code)

---

## What This Is

This demo shows how external job orchestrator can use **Claude Code with a Browserbase cloud browser** to build self-healing bill-pull and bill-pay automations for telecom portals — fast.

The approach has two parts:

1. **Portal exploration** — You give Claude Code a browser and say "go figure out how to pull a bill from Telecom Portal B." It explores the site autonomously, discovers the login flow, finds the billing page, and generates a reusable automation definition.

2. **Job execution** — An API server (matching external job orchestrator's Standard Job API) takes those definitions and runs them at scale using Stagehand AI, which self-heals when portals change their UI.

### Why This Is Different

```
Traditional Approach:
  Engineer → manually writes CSS selectors → breaks on UI change → engineer fixes → repeat

Our Approach:
  Claude Code + Browserbase → explores portal autonomously → generates natural-language steps
  → Stagehand AI executes them → self-heals when UI changes → no maintenance
```

---

## Quick Start

### 1. Setup

```bash
git clone <this-repo>
cd accounts-payable-and-finance/telecom-invoice-automation
npm install
cp .env.example .env
# Edit .env with your Browserbase + Anthropic credentials
```

Your `.env` needs:
```
BROWSERBASE_API_KEY=bb_live_...
ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Explore a Portal (Claude Code + Browserbase)

Open Claude Code in the project directory and say:

```
Explore https://account.telecom-b.example.invalid/signin/v2/ using the Browserbase browser.

Figure out:
- How the login flow works (single page? multi-step?)
- Where the billing/balance information is
- What MFA looks like on this portal

Then save a portal definition to portals/telecom-b.json that the job runner can execute.
```

Claude Code uses `scripts/bb-browse.ts` — a Browserbase-powered browser CLI that:
- Creates cloud browser sessions with `keepAlive: true` for persistent exploration
- Reattaches to the same session across commands via WebSocket
- Auto-captures screenshots after every action
- Uses Stagehand AI for natural-language element interaction

**You review the JSON, tweak if needed, done.** Portal definitions are natural-language instructions — no CSS selectors, no code.

### 3. Run Jobs Against the Portal

```bash
# Start the Standard Job API server
npm run dev

# Submit a bill-pull job
curl -s -X POST http://localhost:3000/job \
  -H "Content-Type: application/json" \
  -d '{"job_id":"test-001","type":"bill_pull","username":"6282797091","password":"yourpass","portal":"telecom-b"}'

# Check status (returns session_id for live Browserbase replay)
curl -s http://localhost:3000/job/test-001

# Submit MFA code when status is "mfa_requested"
curl -s -X PATCH http://localhost:3000/job/test-001 \
  -H "Content-Type: application/json" \
  -d '{"mfa_code":"123456"}'
```

The `session_id` in the response links to the Browserbase dashboard where you can watch the live session or replay it for debugging.

---

## How It Maps to external job orchestrator's PRD

| external job orchestrator Requirement | Our Approach |
|---|---|
| **MFA Request rate** | Built-in MFA detection + pause/resume workflow via `PATCH /job/:id` |
| **Balance Pull success rate** | Stagehand AI extracts balance using natural language, not selectors |
| **Payment Success rate** | Natural-language bill-pay steps adapt to UI variations |
| **Self-healing** | AI interprets instructions at runtime — no brittle selectors to break |
| **Setup time per portal** | Claude Code explores + generates definition in ~5-10 minutes |
| **Standard Job API** | Full implementation of `POST /job`, `GET /job/:id`, `PATCH /job/:id` |

---

## Architecture

```
┌─────────────────────────────────┐
│  1. PORTAL EXPLORATION          │
│                                 │
│  Claude Code + bb-browse CLI    │
│  explores portal via Browserbase│
│  cloud browser, generates       │
│  portal definition              │
│  (portals/*.json)               │
│                                 │
│  Human: review + tweak          │
└────────────┬────────────────────┘
             │ portals/*.json
             ▼
┌─────────────────────────────────┐
│  external job orchestrator Testing Service           │
│  (Daily job runner)             │
└────────────┬────────────────────┘
             │ Standard Job API
             │ POST /job, GET /job/:id, PATCH /job/:id
             ▼
┌─────────────────────────────────┐
│  2. APPROACH SERVICE            │  ← src/server.ts + src/job-runner.ts
│  (Express + TypeScript)         │
│                                 │
│  Loads portal definition,       │
│  creates Browserbase session    │
│  (keepAlive + WS connect),     │
│  runs Stagehand steps,          │
│  handles MFA, returns results   │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐     ┌──────────────────┐
│  Browserbase                    │────▶│  Target Portal   │
│  • Cloud browser (keepAlive)    │     │  (Telecom Portal A, Telecom Portal B, │
│  • Residential proxies          │     │   Telecom Portal C)        │
│  • Verified                 │     └──────────────────┘
│  • CAPTCHA solving              │
│  • Session recording            │
└─────────────────────────────────┘
```

### How Browserbase Sessions Work

Both the exploration CLI and the job runner use the same pattern:

1. **Create** a session via Browserbase SDK with `keepAlive: true`
2. **Connect** Stagehand using `env: "LOCAL"` + `cdpUrl: session.connectUrl` (the WebSocket URL)
3. **Reattach** to existing sessions via `bb.sessions.debug(sessionId)` → fresh `wsUrl`
4. **Release** sessions when done via `bb.sessions.update(id, { status: "REQUEST_RELEASE" })`

This avoids the `stagehand.close()` pitfall (which terminates the remote session) and enables persistent multi-command exploration.

### Portal Definitions — The Key Concept

Portal definitions are JSON files with **natural-language instructions**, not code:

```json
{
  "id": "telecom-b",
  "name": "Telecom Portal B",
  "loginUrl": "https://account.telecom-b.example.invalid/signin/v2/",
  "billPullSteps": [
    {
      "action": "act",
      "instruction": "Type \"{{username}}\" into the Email or phone number input field"
    },
    {
      "action": "act",
      "instruction": "Click the Next button"
    },
    {
      "action": "act",
      "instruction": "Click the 'Log in with password' link"
    },
    {
      "action": "act",
      "instruction": "Type \"{{password}}\" into the Password input field"
    },
    {
      "action": "extract",
      "instruction": "Extract the current bill balance amount and payment due date",
      "schema": { "balance": "number", "due_date": "string" },
      "isFinalResult": true
    }
  ],
  "mfaDetection": {
    "indicators": ["Let's confirm it's you", "6-digit code", "We sent a code"]
  }
}
```

If Telecom Portal B changes "Email or phone number" to "Mobile number", the instruction still works — Stagehand's AI figures it out.

---

## Project Structure

```
flex-bill-automation/
├── CLAUDE.md                    # Instructions for Claude Code on how to
│                                #   explore portals and generate definitions
├── src/
│   ├── types.ts                 # external job orchestrator Standard Job API types + PortalDefinition
│   ├── server.ts                # Express API server (POST/GET/PATCH /job)
│   ├── job-runner.ts            # Core job execution engine (Stagehand + Browserbase)
│   └── portal-loader.ts         # Loads portal definitions from JSON files
├── scripts/
│   ├── bb-browse.ts             # Browserbase browser CLI for portal exploration
│   ├── test-bill-pull.ts        # Test script for bill-pull jobs
│   └── demo-workflow.sh         # Interactive demo walkthrough
├── portals/
│   ├── telecom-a.json                 # Telecom Portal A portal definition
│   ├── telecom-b.json             # Telecom Portal B portal definition (verified working)
│   └── telecom-c.json             # Telecom Portal C portal definition
├── screenshots/                 # Screenshots captured during exploration
├── .bb-session.json             # (gitignored) Active Browserbase session state
├── .env                         # (gitignored) Browserbase + Anthropic credentials
├── .env.example                 # Template for credentials
├── package.json
└── tsconfig.json
```

---

## Addressing external job orchestrator's Phase 2 Concerns

From the PRD's "Note on Phase 2 expectations":

### "What is the process for getting an approach setup?"
Give Claude Code a browser and a URL. It explores the portal via Browserbase cloud browsers and generates the definition. Scale to 50+ portals with a single engineer who just reviews the output.

### "When login requires HITL, it should not take >5 seconds"
Browserbase sessions stream in real-time. MFA is handled via the `PATCH /job/:id` API — the MFA code is injected as soon as it's provided, no delay.

### "Human setup time for each portal?"
~10-15 minutes: Claude Code explores and generates (~5 min), engineer reviews and tweaks (~5-10 min). As Stagehand improves, this gets faster.

### "How adaptable is the solution?"
Adding new actions (reading line items, managing autopay) means adding natural-language steps to the portal JSON. No code changes to the runner. Just tell Claude Code: "also figure out how to read the line items" and it'll explore that too.

### "How long does it take for a job to run?"
Typical bill-pull: 30-60 seconds (including Browserbase session creation). Bill-pay: 45-90 seconds. Browserbase cloud browsers are optimized for automation speed.

---

## Why Browserbase for This Use Case

| Capability | Why external job orchestrator Needs It |
|---|---|
| **Residential Proxies** | Telecom portals block datacenter IPs aggressively |
| **Verified** | Anti-bot detection bypass for Telecom Portal A/Telecom Portal B/Telecom Portal C |
| **CAPTCHA Solving** | Built-in handling when portals show CAPTCHAs |
| **Session Recording** | Full video replay for debugging failed jobs |
| **keepAlive Sessions** | Persistent exploration across multiple CLI commands |
| **Stagehand AI** | Natural-language automation = self-healing |
| **Cloud Browsers** | No infrastructure to manage, scales on demand |

---

## Next Steps

1. **Set up test users** — Get Telecom Portal A/Telecom Portal B/Telecom Portal C test credentials from external job orchestrator
2. **Deploy Approach Service** — Share the API endpoint with external job orchestrator's Testing Service
3. **Iterate on definitions** — Refine portal definitions based on real test results
4. **Explore Functions** — When BB Functions launches, migrate to serverless execution for zero-infra
