# Vault and OTP security boundary

Browsie ships a reference Native Vault and a 1Password SDK provider. The Native Vault is for local open-source demos, not a production password manager. Each record gets a random data key; AES-256-GCM encrypts the payload; the server-only master key wraps the data key. The atomic JSON adapter writes mode `0600`, but deployed applications must replace it with durable database or object storage and a KMS-backed master key.

Set `BROWSIE_VAULT_MASTER_KEY` to 32 random bytes in base64 (or 64 hex characters). Never put it in browser code, Eve state, chat, traces, or logs. Saved passwords and TOTP secrets are never returned by the API or UI.

For automated 1Password access, create a least-privilege service account, grant only the required vault, and set `OP_SERVICE_ACCOUNT_TOKEN` on the server. Browsie uses pinned `@1password/sdk` 0.5.0. For optional local use, enable SDK integration in the 1Password desktop app and set `OP_ACCOUNT`; the normal 1Password approval or biometric prompt applies. Service-account mode takes precedence and is the deployable path.

The model can list only labels, host mappings, field availability, and opaque item/field references. `vault_login` resolves values server-side immediately before filling. Stagehand v4.0.2 does not expose the older `act(..., { variables })` API; Browsie therefore uses a browser-session-bound `experimentalBatch` adapter with Stagehand logging disabled and redacted results. A success selector is mandatory because filling and clicking alone do not prove authentication.

TOTP codes are generated server-side using RFC 6238 and are never stored. Challenges without a mapped TOTP secret must park the Eve task in `waiting_for_user`; the interactive Browserbase Live View remains the primary safe handoff.
