# Browsie

Browsie is an open-source personal browser assistant and a reference build for Stagehand v4. It
shows how an agent harness, browser tools, skills, Browserbase Contexts, and a vault boundary fit
together.

The first release has a ChatGPT-style web chat. Each durable Eve session owns one persistent
browser. The workbench shows the current page, active skill, active Context, and redacted run trace.

## Use this repository

For a human setup, follow [Start Browsie](#start-browsie).

For a coding agent, start in this directory and use this request:

> Read `AGENTS.md` and `.agents/skills/build-browser-agent/SKILL.md`. Set up Browsie, explain the
> required credentials, and run the local checks. Do not print or commit secret values.

`AGENTS.md` contains the repository rules for Codex and other coding agents. `CLAUDE.md` points
Claude Code to the same file. The repo-local `build-browser-agent` skill explains how to copy or
adapt the Browsie architecture without mixing runtime instructions, tool descriptions, skills,
Contexts, and vault data.

## What is included

- One Next.js application with Eve mounted through `withEve`.
- A direct OpenAI Responses API model on `gpt-5.6-sol` with medium reasoning.
- Three Eve-native browser tools: `run`, `snapshot`, and `screenshot`. `run` supports the official
  Stagehand v4 `code` and snapshot `actions` modes.
- Stagehand v4 for both local Chrome and Browserbase-hosted browsers.
- Browserbase proxies and Verified Browsers on every hosted session.
- A draft Browserbase Context for every hosted task, with save and later reuse.
- Native and 1Password vault providers, secure login injection, TOTP, and Live View handoff.
- Durable CAPTCHA events, browser recovery, cancellation, and session replay.
- Browser, task, and site skill examples, including an Amazon login workflow.
- An optional Stripe Link Agent Wallet integration for approved secure checkout.
- An Electron desktop package and an authenticated MCP bridge for other agents.
- A two-step form fixture that always stops before Submit.
- Redacted JSON run traces in `runs/`.

There is no second browser service. Eve tools import the browser runtime directly. One in-process
runtime map binds the Eve session ID to its browser until the session completes or fails.

## Start Browsie

Requirements: Node.js 24, pnpm, and a local Chrome installation.

```bash
cd path/to/cookbook/projects/browsie
pnpm install
cp .env.example .env
pnpm dev
```

Open `http://127.0.0.1:4318`. Add `OPENAI_API_KEY` to `.env` before you start an agent turn.

The local development runner creates a temporary handoff key and uses the local app URL when
`BROWSIE_HANDOFF_SECRET` and `BROWSIE_PUBLIC_URL` are not set. This makes Live View handoff work in
the web app without permanent local secrets. A deployed app must set a stable handoff secret and
an HTTPS public URL.

For public websites with Browserbase, set:

```bash
STAGEHAND_BROWSER=browserbase
BROWSERBASE_API_KEY=<your-browserbase-key>
OPENAI_API_KEY=<your-openai-key>
```

Every hosted session requests these settings:

```ts
{
  proxies: true,
  keepAlive: true,
  browserSettings: { verified: true }
}
```

Browsie does not replace a failed hosted session with a weaker session. It retries creation up to
three times, and each retry has proxies and Verified Browsers enabled. Set
`BROWSERBASE_CONTEXT_ID` to reuse cookies and site state. Do not commit `.env`.

The localhost form fixture uses local Chrome because a hosted browser cannot reach localhost.

## Run the desktop app

The desktop package wraps the same Workbench and Eve runtime. It starts loopback-only services for
the web interface, Eve, and the authenticated MCP bridge. It does not add another browser-control
service.

```bash
pnpm build
pnpm desktop:build
pnpm desktop:dev
```

To build an unsigned macOS installer for a local test:

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm desktop:dist:mac
```

See [the desktop and MCP guide](desktop/README.md) for MCP command mode, the local HTTP bridge, and
hosted-agent setup.

## Optional Stripe Link payments

Set `LINK_ACCESS_TOKEN` to connect a server-side Stripe Link Agent Wallet. Browsie verifies the
checkout details, creates a spend request, waits for Link approval and Eve approval, then injects
the one-time card inside the browser runtime. Card values do not enter model output or activity
events. See [the payment guide](docs/link-payments.md) before you test a charge.

## Test through iMessage with Linq

Browsie uses Eve's native Linq channel. Set the portable Linq credentials on the server:

```bash
LINQ_API_KEY=...
LINQ_WEBHOOK_SECRET=...
```

To limit a test line to known senders, set `BROWSIE_LINQ_ALLOWED_USER_IDS` to a comma-separated
list of exact Linq message author IDs. An empty value accepts every non-bot sender.

Run Browsie on port `4318`, expose it through an HTTPS tunnel, and register this webhook in Linq:

```text
https://<public-host>/eve/v1/linq
```

Subscribe the webhook to `message.received`, `reaction.added`, and `reaction.removed`. Linq keeps
each conversation on one durable Eve session. A new message during active work steers the task and
cancels the previous turn before Browsie continues.

For the lowest-lift local test, first authenticate the official Linq CLI with `linq login`. Then
run one command:

```bash
pnpm dev:linq
```

This command creates a temporary Linq webhook listener, a Cloudflare quick tunnel, and an in-memory
handoff secret. It then starts Browsie with the required process environment. It does not write or
print the Linq API token, webhook secret, or handoff secret. Press Ctrl-C to stop every child
process. The runner starts the project-local Next binary directly and stops only the exact process
IDs that it created. All child processes remain in the terminal foreground group, so Ctrl-C also
reaches Next, Eve, Linq, and Cloudflare directly. The temporary webhook and public URL stop working
when the command exits.

## Persistence and recovery

Eve stores the conversation and event stream. Browsie keeps the browser open across all tools and
turns in the same Eve session. Reloading `/s/<session-id>` resumes the durable chat. Starting a new
task starts a new Eve session, and the earlier tasks stay in the history. For hosted browsers,
Browsie saves the Browserbase session ID for each Eve session. It can reconnect Stagehand after a
process restart. The lifecycle hook closes browsers on terminal Eve events, and an idle guard
closes any browser that receives no tool call for 30 minutes.

A blocked source does not complete a task. The system prompt tells Browsie to inspect the block,
keep the browser open, and try another source. For research, it tries useful alternate origins and
verifies source pages before it answers.

## Architecture

```text
Next.js chat + workbench
          │
       withEve
          │
 Eve durable agent (gpt-5.6-sol, medium)
          │
 run ─ snapshot ─ screenshot
          │
 one browser runtime per Eve session
          │
 Stagehand v4 over local Chrome or Browserbase
```

Both paths use Stagehand v4. Hosted sessions start through Stagehand's Browserbase browser factory,
which installs the Stagehand browser extension. The same three typed Eve tools work with both
browser providers. The teaching material maps to the Stagehand integration examples for Eve,
Codex, Claude Code, CrewAI, Mastra, and other harnesses.

## Read next

- [Repository contribution guide](CONTRIBUTING.md)
- [Coding-agent rules](AGENTS.md)
- [Reusable browser-agent skill](.agents/skills/build-browser-agent/SKILL.md)
- [How the parts work](docs/agent-layers.md)
- [Stagehand and Eve harness design](docs/stagehand-harness.md)
- [Stagehand v4 documentation map](docs/stagehand-v4-doc-map.md)
- [Contexts and vaults](docs/contexts-and-vaults.md)
- [Vault login and OTP handoff](docs/vault-and-otp.md)
- [Stripe Link payments](docs/link-payments.md)
- [Desktop and MCP package](desktop/README.md)
- [Third-party source notices](THIRD_PARTY_NOTICES.md)
- [Content plan](docs/content-plan.md)

## Checks

```bash
pnpm eve:check
pnpm typecheck
pnpm test
pnpm build
pnpm desktop:typecheck
pnpm desktop:test
pnpm desktop:build
```

MIT licensed.
