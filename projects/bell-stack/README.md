# Bell-Stack

Browsie is a self-hosted consumer browser agent and a reference application for Stagehand v4 and
Browserbase. It shows how to combine a durable agent, a persistent browser, saved login state,
human handoff, credentials, messaging, and an inspectable web interface.

> [!CAUTION]
> This is reference code. Review its security, privacy, cost, authorization, and compliance needs
> before you use it with real accounts or deploy it for more than one user.

Bell-Stack starts from the Browsie source at cookbook commit
`fabad0b67d30c63b0f62becf937ab7f8ed3d8108`. It is a separate personal-assistant example under
`projects/bell-stack`. The foundation preserves Browsie runtime names, environment variables, and
UI labels so the architecture can be reviewed before new integrations are added.

## What you can study

- A durable Eve conversation with one persistent Stagehand browser runtime.
- Three basic browser tools: `run`, `snapshot`, and `screenshot`.
- Browserbase sessions with managed proxies, Verified Browsers, and optional proxy location.
- A draft Browserbase Context for every hosted task. A user can later name and save that same
  Context, then use it in another task.
- A native encrypted vault example and an optional 1Password service-account integration.
- Browserbase Live View handoff for OTP, passkeys, login approval, and other human-only steps.
- Durable CAPTCHA state, cancellation, restart recovery, and redacted activity events.
- One agent core for the web interface and the optional Linq iMessage/SMS channel.

## Why it is built this way

The agent harness, browser runtime, and product interface have separate duties:

```text
Web UI or Linq channel
          |
     durable Eve agent
          |
 typed tools and runtime skills
          |
 one Stagehand runtime per Eve session
          |
 Browserbase session + Context + Live View
```

Eve owns the conversation and event history. Stagehand owns browser automation. Browserbase owns
the remote browser, network identity, saved browser state, and Live View. Browsie keeps credentials
behind a vault boundary. It does not put passwords, OTP values, cookies, or authorization headers
in prompts or activity events.

There is no second browser-control service. Eve tools import the browser runtime in the same
process. This keeps session ownership clear and makes cancellation and recovery easier to follow.
See [the harness guide](docs/stagehand-harness.md) and
[the agent-layer guide](docs/agent-layers.md) for the detailed design.

## Run it locally

You need Node.js 24, pnpm, and an OpenAI API key. A Browserbase API key is required for hosted
sessions and for Browserbase Contexts, Live View, proxies, and Verified Browsers.

```bash
git clone https://github.com/browserbase/cookbook.git
cd cookbook/projects/bell-stack
pnpm install
cp .env.example .env
```

Set secret values only in `.env`:

```bash
OPENAI_API_KEY=<your-key>
BROWSERBASE_API_KEY=<your-key>
STAGEHAND_BROWSER=browserbase
```

Then start the application:

```bash
pnpm dev
```

Open `http://127.0.0.1:4318`. Start a task and ask Browsie to use the web. The workbench shows the
live browser, tool activity, active skill, and Context state.

For a local Chrome test, keep `STAGEHAND_BROWSER=auto` and omit `BROWSERBASE_API_KEY`. Local mode
does not provide Browserbase Contexts, Live View, proxies, or Verified Browsers.

## Configuration

| Variable                   | Required     | Purpose                                                              |
| -------------------------- | ------------ | -------------------------------------------------------------------- |
| `OPENAI_API_KEY`           | Yes          | Runs the Eve agent model.                                            |
| `BROWSERBASE_API_KEY`      | Hosted mode  | Creates Browserbase sessions and Contexts.                           |
| `STAGEHAND_BROWSER`        | No           | `auto`, `local`, or `browserbase`.                                   |
| `BROWSIE_MODEL`            | No           | Model name. Default: `gpt-5.6-sol`.                                  |
| `BROWSIE_HANDOFF_SECRET`   | Handoff      | Signs short-lived Browsie handoff links. Use at least 32 characters. |
| `BROWSIE_PUBLIC_URL`       | Handoff      | Public HTTPS origin for handoff links.                               |
| `BROWSIE_VAULT_MASTER_KEY` | Native vault | Encrypts the local vault example.                                    |
| `OP_SERVICE_ACCOUNT_TOKEN` | 1Password    | Gives server-side access to an allowed 1Password vault.              |
| `LINQ_API_KEY`             | Linq         | Enables the Linq channel.                                            |
| `LINQ_WEBHOOK_SECRET`      | Linq         | Verifies Linq webhooks.                                              |

Read [`.env.example`](.env.example) for every option. Never commit `.env` or secret values.

## Test it

The default tests do not call live services. From this directory, run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:linq-local
```

The `*-real.test.ts` and live CAPTCHA tests need explicit service credentials. They skip when the
required credentials are absent. Run them only against accounts and sites that you are authorized
to use. Treat usage as billable Browserbase and model activity.

Useful manual checks:

1. Start a hosted task and confirm that Live View appears.
2. Sign in through Live View, then save the draft Context with a clear name.
3. Start another task, select that Context, and confirm that the login state is present.
4. Stop an active task and confirm that model work and browser work both stop.
5. Open the activity feed and confirm that tool inputs are useful and private values are redacted.

## Optional iMessage and SMS test

Browsie uses Eve's Linq channel. Set `LINQ_API_KEY` and `LINQ_WEBHOOK_SECRET`, expose port `4318`
through HTTPS, and register `/eve/v1/linq` as the Linq webhook path. For a temporary local test,
authenticate the Linq CLI and run:

```bash
pnpm dev:linq
```

The runner creates a temporary webhook and tunnel. It does not print Linq credentials. Stop the
command to remove the temporary endpoint. Read the comments in `scripts/linq-local.mjs` before you
adapt this flow for a deployment.

## Storage and deployment notes

Browsie is ready for a local or single-instance reference deployment. It is not a finished
multi-tenant service.

- Eve stores durable conversation and event state.
- Browserbase Contexts store browser cookies and site state.
- Browsie stores Context labels and native-vault data in local files under `.browsie/`.
- Browser session recovery uses saved Browserbase session metadata.
- The 1Password integration uses one server-side service account.
- Handoff links expire, but they are not single-use links.

Before a multi-instance or multi-user deployment, replace local files with a durable database,
put encryption keys in KMS, isolate all records by user or tenant, add authentication and access
control, make handoff tokens one-use, add rate limits and audit retention, and define secret
rotation and deletion procedures.

## Repository guide

- [`AGENTS.md`](AGENTS.md): rules for coding agents that modify Browsie.
- [`.agents/skills/build-browser-agent/SKILL.md`](.agents/skills/build-browser-agent/SKILL.md): a
  reusable guide for developers who want to adapt this architecture.
- [`docs/contexts-and-vaults.md`](docs/contexts-and-vaults.md): browser identity and credentials.
- [`docs/vault-and-otp.md`](docs/vault-and-otp.md): vault login and human handoff.
- [`docs/stagehand-v4-doc-map.md`](docs/stagehand-v4-doc-map.md): links to official Stagehand and
  Browserbase documentation.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): development and validation rules.

Browsie is licensed under the MIT License. See [`LICENSE`](LICENSE).
