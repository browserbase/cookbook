# How the agent layers work

Browsie uses five separate layers. Each layer has one job.

| Layer            | Its job                       | What belongs here                                   |
| ---------------- | ----------------------------- | --------------------------------------------------- |
| System prompt    | Set stable behavior           | Instruction order, page trust boundary, submit rule |
| Tool description | Define an exact interface     | Inputs, outputs, state rules, ID lifetime           |
| Skill            | Give a task or site procedure | Form steps, Amazon research checks                  |
| Context          | Give the browser an identity  | Cookies, local storage, saved sign-in state         |
| Vault            | Supply a secret at use time   | Passwords, one-time codes, API credentials          |

Do not copy one layer into all other layers. Repeated instructions create conflicts and make failures
hard to find.

## System prompt

Keep the system prompt stable and specific. Explain who the browser operator is, what environment
it controls, how its tools work, how it recovers, and how it verifies completion. Put site steps in
skills instead of adding them to the system prompt.

## Tool descriptions

Tool descriptions are contracts, not tutorials. Browsie exposes three browser tools:

- `snapshot` reads the current accessibility tree. Its bracketed IDs expire after the page changes.
- `run` makes a short batch of exact changes in the current browser.
- `screenshot` records visual state when the accessibility tree is not sufficient.

All three tools use the same browser session. A tool must not start a new browser.

## Skills

A skill is a small Markdown procedure. Eve loads Browsie skills from `agent/skills/**/SKILL.md`.
The skill content sets its scope:

- Browser skills contain browser-wide procedure.
- Task skills contain common jobs, such as form filling.
- Site skills contain website-specific procedure.

Load only the skill that matches the request. A good skill states when to use it, what to check, and
where to stop. It must not contain secrets.

## Contexts

A Browserbase Context keeps browser state between sessions. It can keep cookies and site state, but
it is not a password manager. Use a fresh Context when a task must not share identity or state.

## Vault

A vault stays outside the model prompt, skill files, and traces. A later vault adapter can inject a
credential into the active browser only when a task needs it. Browsie includes this boundary in its
interface, but it does not include a 1Password adapter in Phase 1.
