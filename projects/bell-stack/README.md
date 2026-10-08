# Bell-Stack

A separate personal-assistant project that imports Browsie's browser capabilities instead of
copying its application. Bell owns its Eve agent, interface, configuration, and merchant integration.
The sibling `browsie` package supplies Stagehand/Browserbase session management, browser tools,
Contexts, human handoff, the optional Linq channel, and optional 1Password access.

## Run locally

Use Node.js 24 and pnpm 10.33.4. Clone the whole cookbook so the sibling dependency is available:

```sh
cd cookbook/projects/browsie
pnpm install --frozen-lockfile
pnpm build:library
cd ../bell-stack
pnpm install --frozen-lockfile
cp .env.example .env
# Set OPENAI_API_KEY and BROWSERBASE_API_KEY in .env.
pnpm dev
```

Open `http://127.0.0.1:4320` and select **Open demo site**. Bell opens the configured `BELL_DEMO_URL`
in one persistent Browserbase session. Ask for a screenshot to update the capture panel. Follow-up
messages at the same `/s/...` address reuse the conversation and browser. Stop cancels active work.
The panel is a screenshot viewer; use `human_handoff` when you need to interact with the browser.

The `file:../browsie` dependency is intentional. This project is a separate runnable app, but it
requires the sibling package at install time. It does not call a second deployed Browsie service.
There is one Eve runtime and one browser per conversation. Do not install a different Eve version
in either project without testing the shared runtime. The lockfile is generated dependency data.

## Baselayer merchant demo

Set `BASELAYER_API_KEY`, `BASELAYER_PRINCIPAL_REF`, and `BASELAYER_ALLOWED_ORIGINS` in `.env`.
The principal must be eligible in the same Baselayer sandbox account. Keep
`BROWSIE_LOG_SESSION=false` before starting a browser so request credentials are not recorded.
`BELL_DEMO_URL` selects the visible demo target. The allowlist contains exact HTTPS origins.
Changing merchants requires both the new URL and its allowlist entry; the merchant must implement
an L2 KYA profile at `/.well-known/kya-profile.json`, a same-origin nonce endpoint, and verification.

Sandbox timing note: newly minted agent credentials usually expire after about one hour.
Check the returned `expiresAt` or credential `exp` for the actual expiry, and mint a fresh
credential when needed. This is separate from the revocation status list's own expiry;
a fresh agent credential does not make an expired status-list token valid.

For a standalone mint, run `pnpm baselayer:mint https://bell-stack-demo-site.vercel.app`.
The CLI writes the credential and ephemeral presenter key into a private temporary directory,
with secret files restricted to mode 0600. It prints only the directory, audience, and expiry.
Minting alone does not grant browser access.

To film the full flow, open the app and keep the same conversation:

1. Select **Open demo site**. Confirm the protected merchant denies the ordinary visit.
2. Ask: "Use merchant_access for https://bell-stack-demo-site.vercel.app/protected, then snapshot
   and screenshot the page." Confirm HTTP 200 and the wholesale catalog.
3. Ask: "Use ordinary run/goto on that same URL, then snapshot and screenshot." Confirm denial
   again. The credential was attached only to the approved main-frame request.
4. Ask for merchant_access again to demonstrate a fresh nonce-bound presentation.

The merchant handler blocks redirects and strips credential headers from subresources. A
revocation-status service error can trigger one retry with a fresh nonce. Results expose status,
audience, scope, and attempts, never the credential or signing key. The merchant site is hosted
separately; this project does not deploy or replace it.

## Optional integrations

- 1Password: for local desktop access, set `OP_ACCOUNT="Your account name"` in `.env.local`,
  using the account name shown in the 1Password sidebar. In the desktop app, enable
  **Settings > Developer > Integrate with other apps** under the SDK options, then approve
  the request when prompted. Bell must run on the same computer as the desktop app.
  For hosted access, set `OP_SERVICE_ACCOUNT_TOKEN` instead; it takes precedence over `OP_ACCOUNT`.
  Save a Login item with the destination website, username, and password before asking Bell to log in.
  Add a one-time password field if the site uses TOTP. The shared vault tools enforce the saved
  website host and resolve credentials on the server. A URL alone does not provide a login.
- Linq: configure `LINQ_API_KEY`, `LINQ_WEBHOOK_SECRET`, and `BROWSIE_LINQ_ALLOWED_USER_IDS`.
  Expose the app through an authenticated HTTPS endpoint and register `/eve/v1/linq` with Linq.
  Each Linq conversation uses the same Bell agent definition; it has its own Eve conversation.
- Handoff: set a random `BROWSIE_HANDOFF_SECRET` of at least 32 characters and
  `BROWSIE_PUBLIC_URL` to the app's reachable origin. Configure this before asking for a handoff.

The shared runtime retains its `BROWSIE_*` configuration names. Bell does not copy the Context or
Vault administration screens. Their agent tools remain available. Stripe Link CLI and Visa
checkout are follow-up integrations; this project does not yet submit payments.

## Check the code

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

The default suite makes no live provider calls. A successful build verifies compilation only.
Keep this demo local until you configure application authentication and durable storage. Eve's
default HTTP channel rejects unauthenticated production traffic. The shared vault/Context data
uses local files and is scoped to a single demo operator. See `../browsie/README.md` for runtime
settings and `../browsie/docs/vault-and-otp.md` for the credential boundary.
