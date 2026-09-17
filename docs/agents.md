# Use the cookbook with a coding agent

The [Browserbase cookbook skill](../skills/browserbase-cookbook/SKILL.md) selects a topic, compares relevant recipes, and opens the selected code. Topic references travel with the skill. The complete source code stays in this checkout.

## Codex

From the cookbook root, link the skill into your personal skills directory:

```sh
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
ln -s "$PWD/skills/browserbase-cookbook" "${CODEX_HOME:-$HOME/.codex}/skills/browserbase-cookbook"
```

If that destination already exists, inspect it before replacing it. Start a new Codex task after installation. Ask:

```text
Use $browserbase-cookbook to find a Python recipe for persistent login sessions.
```

The repository also includes a [Codex plugin manifest](../.codex-plugin/plugin.json) for environments that support local plugin packaging.

## Claude Code

From the cookbook root, start a session with the local plugin:

```sh
claude --plugin-dir .
```

Ask the agent to use `browserbase-cookbook`. A [local marketplace manifest](../.claude-plugin/marketplace.json) packages the same skill for marketplace-based installation.

## Cursor

From the project where you want the skill, create `.cursor/skills` and link the cookbook's skill directory there. Replace the path below with your cookbook checkout location.

```sh
mkdir -p .cursor/skills
ln -s /absolute/path/to/cookbook/skills/browserbase-cookbook .cursor/skills/browserbase-cookbook
```

Ask Cursor to use `browserbase-cookbook` for the task.

## A copied skill without a checkout

If you copy the skill directory instead of linking it, set `BROWSERBASE_COOKBOOK_DIR` to the cookbook root in the agent's environment. Pinned upstream links are provenance references, not runnable substitutes for the local recipe. Restricted sources still require authorized access.

No installation step needs to copy restricted applications into an agent's global skills directory.

## What to expect

A useful response identifies the selected recipe, explains its fit, links the guide and source, and states the setup directory and relevant caveats. The agent reads only the matching topic references before opening the selected recipe.

Try requests that exercise different routes:

- Find a raw Playwright example in Python without an LLM.
- Add Browserbase to a Convex application.
- Build a TypeScript agent that pauses for human input.
- Download financial statements and parse the result.

The skill supports recipe selection and adaptation. It does not grant permission to run payment, messaging, or other business actions found in an example.
