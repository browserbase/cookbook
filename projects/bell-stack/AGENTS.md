# Bell-Stack agent guidance

Read [README.md](README.md) before you change Browsie. For work that adds or adapts the
browser-agent architecture, also read
[the build-browser-agent skill](.agents/skills/build-browser-agent/SKILL.md).

## Product goal

Browsie is a self-hosted reference application for consumer browser agents. It must stay easy to
read, run, inspect, and copy. Prefer a complete example over a generic framework or a second
service.

## Architecture rules

- Keep one durable Eve conversation connected to one persistent Stagehand browser runtime.
- Keep `run`, `snapshot`, and `screenshot` as the basic browser contract. Add a tool only when it
  provides a separate product capability, such as Context management or human handoff.
- Use Browserbase Contexts for cookies and browser identity. Use the vault boundary for
  credentials. Do not put credentials in Context metadata, prompts, events, traces, or responses.
- Start each hosted task with a draft Context and `persist: true`. Promote that same Context when
  the user asks to save it.
- Use Browserbase Live View for OTP, passkeys, login approval, and other human-only steps. Do not
  expose raw Browserbase debugger URLs or session IDs to users.
- Keep managed proxies and Verified Browsers enabled on hosted sessions and on all replacement
  sessions. Apply proxy location before the browser starts.
- Treat CAPTCHA-solving events as durable task state. Wait for Browserbase solving before you ask
  the user to take control.
- Cancellation must stop the active Eve turn and the active browser operation, then leave the
  session in a consistent state.
- Preserve the web Workbench as the inspection surface. Messaging channels such as Linq must use
  the same agent, tools, state, and browser runtime.
- Do not add a separate browser-control service. Eve tools import the browser runtime directly.

## Instruction boundaries

- `agent/instructions.md` controls Browsie at runtime.
- `agent/tools/*` descriptions explain when and how the model calls one tool.
- `agent/skills/*` contains runtime guidance for a site or task.
- This file guides coding agents that modify the repository.
- `.agents/skills/build-browser-agent/SKILL.md` guides coding agents that copy or adapt the
  architecture.

Do not move repository-development rules into the runtime prompt. Do not place site-specific
workflows in global instructions when a runtime skill can contain them.

## Source map

- `agent/`: Eve instructions, tools, skills, hooks, and channels.
- `server/`: browser lifecycle, Context metadata, vaults, traces, and handoff tokens.
- `src/`: web chat, Workbench, Context Studio, and Vault Studio.
- `app/`: Next.js routes, fixtures, and handoff pages.
- `docs/`: architecture decisions and feature guides.
- `tests/`: unit tests and opt-in live integration tests.

Read the relevant guide before a material change:

- `docs/stagehand-harness.md` for the browser tool and harness boundary.
- `docs/contexts-and-vaults.md` for identity and credential storage.
- `docs/vault-and-otp.md` for vault login and human handoff.
- `docs/stagehand-v4-doc-map.md` for current official Stagehand and Browserbase documentation.

## Security

- Keep secrets in environment variables or a supported secret manager. Never commit `.env`.
- Redact passwords, tokens, cookies, OTP values, and authorization headers from events and traces.
- Keep handoff links short-lived, encrypted, and private. Send only the Browsie handoff URL.
- Keep Linq webhook verification enabled. Use an explicit sender allowlist for private tests.
- Treat authenticated Contexts and everything reachable through them as privileged data.
- Do not weaken validation, isolation, tests, or security controls to make a check pass.

## Development

Use Node.js 24 and pnpm. From this directory:

```bash
pnpm install
pnpm install
pnpm dev
```

Run these checks before you commit:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:linq-local
```

Live tests are opt-in because they use external services. Do not run them without the required
credentials and clear authorization. Report skipped live tests separately from passing unit tests.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
