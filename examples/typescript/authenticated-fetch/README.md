# Authenticated Fetch

Log in once in a Browserbase browser, save its cookies in a context, then fetch a protected page using `process.env.BROWSERBASE_CONTEXT_ID`. The login and Fetch scripts run separately. See the [Authenticated Fetch documentation](https://docs.browserbase.com/platform/fetch/authenticated-fetch) for context setup, cookie behavior, and limitations.

**Draft for the Authenticated Fetch launch.** Requires a project enabled for Authenticated Fetch. The API/docs publication is gated on [core PR #12715](https://github.com/browserbase/core/pull/12715); this example does not establish general availability.

## Setup

Requires Node.js 22.18+, pnpm 10.24.0, and a Browserbase API key from [Settings](https://www.browserbase.com/settings). No model key or local browser installation is needed.

From the cookbook root:

```sh
cd examples/typescript/authenticated-fetch
pnpm install --config.minimumReleaseAge=10080
cp .env.example .env
```

Set `BROWSERBASE_API_KEY` in `.env`, then:

```sh
pnpm login
```

Following the [saved-login workflow](https://docs.browserbase.com/platform/fetch/authenticated-fetch), `login.ts` creates a context (or reuses `BROWSERBASE_CONTEXT_ID` if set), opens a browser session with `persist: true`, and logs into [The Internet's public authentication demo](https://the-internet.herokuapp.com/login). The credentials in the script are the public credentials displayed on that page. It verifies the protected welcome text and Logout link, requests session release even on failure, waits for completion, and allows five seconds for context synchronization.

Copy the printed `BROWSERBASE_CONTEXT_ID=...` line into your local `.env`. Use the same Browserbase project for both scripts.

```sh
pnpm start           # raw HTML -> .audit/page.html
pnpm start markdown  # Markdown -> .audit/page.md
pnpm start json      # schema-based extraction -> .audit/page.json
```

Using [Authenticated Fetch](https://docs.browserbase.com/platform/fetch/authenticated-fetch), `index.ts` passes the context ID to `bb.fetchAPI.create`. It checks the raw response for the protected welcome text and logout link before saving anything. A 200 status alone is insufficient: an expired login can redirect to a login page that also returns 200. Markdown and JSON each make one additional Fetch request after this check. JSON uses a language model to extract the heading and welcome message; it is not independent proof of authentication. The script also checks the converted response before saving it.

Successful output reports the saved file, without printing page contents, cookies, API keys, or browser connection URLs. `.audit/` and `.env` are Git-ignored. The login script prints the context ID so you can configure Fetch; keep it local. Each login creates a billed browser session and, unless reusing an ID, a persistent context. Fetch calls are billed separately, including extraction for Markdown/JSON. The context remains available after the script exits.

## Adapt to your site

Change the login URL, form locators, and credentials in `login.ts`, and the protected URL and expected text in `config.ts`. Replace the logout/content checks and JSON schema in `index.ts` with checks specific to your authenticated page. Load real credentials from environment variables or a secret manager; never hardcode them. Only use a site/account you are authorized to automate. For MFA, complete login in the browser before ending the session.

Fetch only sends saved cookies, scoped to the correct domain/path across redirects. It does not execute JavaScript or replay localStorage tokens as Authorization headers. Use a browser session for JavaScript-rendered content or JS-only authentication. The demo's server-rendered, cookie-authenticated secure page is deliberately compatible with Fetch.

## Troubleshooting

- **Protected content missing:** cookies may have expired or login failed. Run `pnpm login` with the existing context ID, then retry Fetch. Fetch is read-only and does not persist response cookies back into the context.
- **404 / `context_cookies_unavailable`:** no cookies were saved, synchronization is still in progress, or the context was last saved before September 1, 2026. End a browser session using that context with `persist: true`, wait a few seconds, then retry.
- **400 / `Context ID not found`:** check the context ID and project/API key pairing.
- **400 / project not enabled or unsupported:** contact Browserbase support to enable Fetch context access for the project.
- **400 / `context_storage_access_denied`:** for BYOS, check the configured role, trust policy, and S3 context read permissions.
- **Login/session failure:** check configuration and the session in the Browserbase dashboard. A failed login never prints a success/context handoff. The session also has a three-minute timeout.

The pinned SDK predates the `contextId` type. The request variable in `index.ts` carries that documented API field without a type cast; the SDK serializes it into the JSON body. This does not bypass the server's launch gate.

## Validation

```sh
pnpm typecheck
pnpm test
```

A fresh package installation with pnpm 10.24.0 and the seven-day release-age policy, TypeScript compilation, and five offline tests passed on Node.js 24.19.0. The tests execute the Fetch script against a local mock HTTP endpoint, checking context serialization, all three formats, and rejection of a login page returning HTTP 200, and the project-not-enabled error. They do not exercise browser login or remote persistence. Live validation on October 19, 2026 verified login, session completion, and persisted authentication: a second browser session opened the protected page using the saved context without logging in again. Both browser sessions completed. An anonymous Fetch returned the login page with HTTP 200 and no protected text.

The first authenticated Fetch attempt was blocked by project feature enablement (HTTP 400). A subsequent live retry with the same saved context passed for raw HTML, Markdown, and schema-based JSON. Each mode verified protected content and saved its output under `.audit/`. This confirms the browser login → persisted context → authenticated Fetch workflow on the tested project; other projects still need feature access. The public demo can change or be unavailable.
