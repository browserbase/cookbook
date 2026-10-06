# Contributing to Browsie

Browsie is a reference application. Changes must make the Stagehand and Browserbase patterns
clearer, more reliable, or easier to copy.

## Before you start

1. Read [AGENTS.md](AGENTS.md).
2. Read the document for the area you will change.
3. Keep the change inside `projects/browsie` unless cookbook metadata must change.
4. Do not commit credentials, `.env`, browser data, run traces, or customer data.

For a new browser-agent capability, read
[the build-browser-agent skill](.agents/skills/build-browser-agent/SKILL.md). For a UI-only change,
the skill is not required.

## Design rules

- Keep one agent core for web and messaging channels.
- Keep browser state in Browserbase Contexts and secrets behind a vault boundary.
- Keep runtime behavior in `agent/instructions.md`, tool-specific behavior in tool descriptions,
  and site or task procedures in runtime skills.
- Add events that explain observable work. Do not log private values.
- Add or update tests for behavior changes.
- Document configuration that a developer must provide.

## Validation

From `projects/browsie`, run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:linq-local
```

The live tests use real Browserbase, model, Linq, or 1Password resources. Run them only when the
change requires them and you have authorization. State which live tests ran and which tests were
skipped.

## Pull requests

Describe:

- The user problem.
- The changed architecture or behavior.
- The checks that passed.
- Any new environment variables.
- Any security, cost, or compatibility effect.
