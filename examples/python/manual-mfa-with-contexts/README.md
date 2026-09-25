# Stagehand + Browserbase: Manual MFA with Contexts

Stagehand is the SDK for browser agents.

## AT A GLANCE

- Goal: verify whether a manually authenticated GitHub account can be reused in a second Browserbase session.
- Flow: create a context → verify the signed-in account → close the first session → verify the same account in a second session → delete the temporary context.

## GLOSSARY

- context: a Browserbase feature that persists browser state (cookies, localStorage, sessionStorage) across sessions.
  Docs → https://docs.browserbase.com/features/contexts
- persist: setting that saves authentication state including MFA trust/remember device state to the context.
- MFA (Multi-Factor Authentication): two-factor authentication requiring a code from an authenticator app.
- session persistence: maintaining logged-in state across multiple browser sessions without re-authentication.

## QUICKSTART

From this example's directory, install its declared dependencies:

```sh
uv sync
test -f .env || cp .env.example .env
```

Configure your credentials and any account inputs in `.env`, then run:

```sh
uv run main.py
```

For pip, create and activate a virtual environment, then run `python -m pip install -r requirements.txt` and `python main.py`. Both dependency files declare the same runtime requirements. Running the script creates browser sessions and may interact with the configured account.

## Expected behavior

The first session fills credentials and pauses for manual MFA when detected. It prints the exact owned session URL, which should remain private. A changed URL or absent MFA prompt alone is not success: the session must reach GitHub's protected profile settings and report the currently signed-in account matching `GITHUB_USERNAME` (case-insensitive).

After the first session closes, the example waits briefly and creates a second session using the same context. It checks the account again without filling credentials. Only after both sessions close and the temporary context is deleted does it announce verified reuse for those two sessions. Empty, uncertain, different-account, redirected-login, or cleanup failures stop success reporting. Future sessions may still require MFA; a five-second delay alone is not proof of context synchronization.

The account check uses model extraction from the account menu/settings identity, so extraction can fail or be mistaken. Synthetic tests verify the acceptance and cleanup logic, not live GitHub authentication, model accuracy, or Browserbase persistence.

## COMMON PITFALLS

- "ModuleNotFoundError": ensure all dependencies are installed with `uv sync`
- Missing credentials: verify .env contains BROWSERBASE_API_KEY, GITHUB_USERNAME, and GITHUB_PASSWORD
- MFA timeout: ensure you complete MFA within 2 minutes, or increase timeout value
- 2FA not enabled: GitHub account must have 2FA enabled for this demo to work
- Context not persisting: verify context.persist is set to true in browser_settings

## USE CASES

• Payment automation: Complete MFA once for utility portals, then automate future payments without MFA prompts.
• Account management: Persist authentication for services requiring MFA, enabling automated account management workflows.
• Compliance automation: Store trusted device state for regulatory portals, reducing friction for recurring compliance tasks.

## NEXT STEPS

• Store context IDs: Save context_id per customer in your database to reuse across sessions.
• Multi-portal support: Extend to multiple portals/services, each with their own context.
• Context management: Implement context cleanup, rotation, and expiration policies.
• Error handling: Add retry logic and better error messages for MFA timeouts.

## HELPFUL RESOURCES

📚 Stagehand Docs: https://docs.stagehand.dev/v4/first-steps/introduction
🎮 Browserbase: https://www.browserbase.com
📚 Contexts Docs: https://docs.browserbase.com/features/contexts
💡 Try it out: https://www.browserbase.com/playground
🔧 Templates: https://www.browserbase.com/templates
📧 Need help? support@browserbase.com
💬 Discord: http://stagehand.dev/discord

Run `python -B -m unittest discover -s tests -v` for synthetic identity and cleanup tests.
