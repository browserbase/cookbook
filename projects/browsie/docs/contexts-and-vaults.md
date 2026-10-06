# Contexts and vaults

Browser identity has two parts. A Context keeps browser state. A vault supplies secrets.

## Browserbase Context

Set `BROWSERBASE_CONTEXT_ID` and use `STAGEHAND_BROWSER=browserbase`. Browsie passes the Context to
the Browserbase session with persistence enabled. This can keep cookies and site state for later
sessions.

Use a separate Context for each identity or work boundary. Do not use one shared personal Context
for all users of a deployed Browsie server.

## Vault boundary

The Phase 1 interface shows a vault area, but it does not read credentials. A future 1Password
adapter should follow these rules:

1. The user chooses a vault item by an opaque ID.
2. The model sees a label, not the secret value.
3. A trusted adapter writes the value into the exact browser field.
4. The adapter does not return the value to the model.
5. The run trace records that a credential was used, but not its value.

Skills can say when a credential is necessary. Skills must not contain the credential.
