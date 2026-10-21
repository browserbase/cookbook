# Card entry with Evervault Browser Tokens

A code-first example of the [Browserbase + Evervault integration](https://docs.browserbase.com/integrations/evervault/introduction). A minimal local page collects an encrypted test card; a TypeScript workflow creates Browser Tokens and automatically compares proxied and direct checkouts using Stagehand v4.

Use **your own Evervault sandbox app and public fixtures only**: Visa test number `4242 4242 4242 4242`, dummy CVC `123`, fixed expiry `12/34`. No purchase or real charge occurs. Never enter real cards or customer data.

## Prerequisites

- Node.js **24.x** and npm **12.2.0** (or a compatible npm release supporting `min-release-age`).
- Your own Browserbase project/API key, with external-proxy and custom-CA support. The API key scopes certificate upload and browser sessions to your project; a separate project ID is not needed.
- Your own Evervault **sandbox** Team ID, App ID, server API key, and Browser Tokens access. Configure Card Collection to accept your local page origin if your app requires an origin allowlist.
- A domain you control with HTTPS access to this machine for the synthetic merchant. Remote Browserbase sessions cannot reach `127.0.0.1` on your computer.

The local page stays at `http://127.0.0.1:4173`. Only three merchant routes are exposed over HTTPS. You can study and test the code without credentials; credentials are required for setup and live execution.

## Install and configure

From the cookbook root:

```sh
cd examples/typescript/evervault-browser-tokens
npm ci --ignore-scripts --min-release-age=7
test -f .env || cp .env.example .env
chmod 600 .env
```

Fill in your own values in `.env`. Never paste keys into chat, client code, URLs, or committed files.

| Variable                        | Purpose                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `EVERVAULT_TEAM_ID`             | Public Team ID used by hosted collection.                                                                                                  |
| `EVERVAULT_APP_ID`              | Public sandbox App ID used by hosted collection and server authentication.                                                                 |
| `EVERVAULT_API_KEY`             | Server-only sandbox API key.                                                                                                               |
| `BROWSERBASE_API_KEY`           | Server-only Browserbase key.                                                                                                               |
| `BROWSERBASE_CA_CERTIFICATE_ID` | Uploaded Evervault CA ID, written by setup or supplied by you.                                                                             |
| `CARD_TARGET_HOST`              | Exact public merchant hostname, such as `cards.example.com`; no scheme, path, port, wildcard, or IP. Replace the example with your domain. |
| `PORT`                          | Local page/API port; defaults to `4173`. Update the proxy target too if changed.                                                           |

Run certificate setup explicitly:

```sh
npm run setup
```

This command contacts Browserbase and Evervault. If no certificate ID is configured, it downloads the CA from `https://ca.evervault.com`, validates that it is a currently valid CA, uploads it, and saves the ID to your private `.env` with mode `0600`. It prints only a public certificate fingerprint, never credentials. An existing ID is checked for access with your API key and reused. The API returns certificate metadata, so setup cannot attest to the contents of a previously supplied certificate: verify that it is the Evervault CA you intended to trust. A failed save may still have created a certificate; inspect your project before retrying. Setup launches no browser sessions.

### Expose only the synthetic merchant

`Caddyfile.example` is a complete route-limited HTTPS proxy example. On a machine reachable through your domain, install Caddy using its official instructions, point your domain's DNS at that machine, and permit the ports Caddy needs for HTTPS provisioning. Run Caddy on the same machine as this loopback-only demo.

1. Set `CARD_TARGET_HOST` to your exact domain.
2. Copy `Caddyfile.example` to a private local Caddyfile outside this repository and replace `cards.example.com`. If you changed `PORT`, change its upstream port too.
3. Validate and run that file:

```sh
caddy validate --config /path/to/your/Caddyfile --adapter caddyfile
caddy run --config /path/to/your/Caddyfile --adapter caddyfile
```

Do not enable request-body logging. The example exposes only:

- `GET /mock-merchant/checkout`
- `GET /merchant.css`
- `POST /mock-merchant/authorize`

Every other public path returns `404`. The proxy preserves the public Host header; the application also rejects that host for local page and API routes. Do not expose the entire application through a tunnel, change its loopback bind address, rewrite Host to the local page host, or forward `/api/*`.

Check the boundary before running the demo (these calls do not create sessions):

```sh
# Replace cards.example.com with CARD_TARGET_HOST.
curl --fail https://cards.example.com/mock-merchant/checkout
curl -i https://cards.example.com/api/config   # must be 404
curl -i https://cards.example.com/             # must be 404
```

## Run

```sh
npm start
```

Open **`http://127.0.0.1:4173`** using that exact origin. Enter the public number and CVC inside Evervault's hosted fields, then click **Run comparison** once. The page sends only ciphertext to the local backend. Both browser paths run automatically; no model, manual checkpoints, or embedded Live Views are involved.

The returned tokens appear beside the original public fixtures while the workflow runs. Both browsers receive the same tokens. Expected results:

| Network path                 | Merchant receives                                      | Result               |
| ---------------------------- | ------------------------------------------------------ | -------------------- |
| Evervault proxy + trusted CA | Original public test values, revealed over the network | Approved             |
| Direct Browserbase control   | Unchanged Browser Tokens                               | Declined as expected |

Both sessions close immediately after verification. The page clears tokens, retains the result and cleanup status, and restores hosted collection for another comparison. Any unconfirmed outcome stays **Not confirmed**; it is never presented as success.

**Cancel** prevents further workflow steps, waits for in-flight operations to settle, and releases acquired resources, including sessions that finish launching after cancellation. It cannot undo a submission already started. Normal SIGINT/SIGTERM shutdown also waits for cleanup. Each session has a 240-second server timeout and `keepAlive: false`; a forced process kill cannot run cleanup code.

Keep the server and page open until cleanup finishes. Closing or reloading the page loses its run controls and does not cancel the automatic workflow. If startup, Cancel, or cleanup cannot be confirmed, check the server and Browserbase dashboard before retrying. Starting another run while one is active returns `409`.

## Read the integration code

Start with [src/card-run.ts](src/card-run.ts). Its sequence is:

1. Create five-minute tokens from ciphertext using `permissions: [{ action: "decrypt", target: CARD_TARGET_HOST }]`.
2. Launch two matched Browserbase sessions. Only the proxied path adds the returned external proxy credentials and `proxySettings.caCertificates`.
3. Attach Stagehand with logging off, navigate to the synthetic merchant, fill identical tokens, and submit once. Check expiry again before filling and submitting.
4. Verify the exact HTTPS destination and approval/direct-decline outcomes.
5. Close Stagehand, close browsers, request release, and confirm every acquired session is `COMPLETED`, including after partial failures.

[src/evervault.ts](src/evervault.ts) contains the token request and response validation. [src/server.ts](src/server.ts) serves the minimal page, local API, and synthetic merchant. The small current-run controller holds one cancellation signal and sanitized status in memory; it retains only the latest result until another comparison starts.

```text
Evervault-hosted card fields → ciphertext → local server → Browser Tokens
  ├─ same tokens → Stagehand / Browserbase + Evervault proxy → test values → approved
  └─ same tokens → Stagehand / direct Browserbase           → tokens      → declined
```

## Costs, side effects, and boundaries

- Each live comparison starts **two billable Browserbase sessions**. Explicit setup contacts Evervault and Browserbase and may upload a CA certificate; it starts no sessions. The HTTPS reverse proxy also requires reader-managed infrastructure.
- API keys and proxy credentials stay server-side. Ciphertext is cleared after token creation; temporary token values are visible only in the local page and clear after cleanup. Do not log, record, screenshot, persist, or share runtime values.
- Browserbase session recording/logging and Stagehand logging are disabled. Provider errors are redacted. The local API requires the loopback Host, same origin, and a custom header; it is not multi-user authentication. No request body or private session link is returned or logged.
- Reveal permission and browser navigation are restricted to the exact configured merchant hostname. Wildcards and certificate-error bypasses are not used.
- The synthetic merchant receives the public fixture in plaintext and accepts only that fixture. It never logs, persists, echoes, or redirects with submitted values. Anyone knowing its hostname can call its public routes, but those routes cannot start sessions. Remove the proxy when finished.
- This demonstrates the fixture's immediate response, not settlement, arbitrary checkout compatibility, production readiness, or PCI compliance. Production collection, retention, merchant/PSP separation, client validation, payment iframes, 3DS, authentication, and compliance need their own design and review.

## Verification

```sh
npm run check
```

**The current automatic implementation is offline-tested only.** Tests mock every Evervault and Browserbase call and cover configuration, token policies/expiry, matched sessions, outcomes, cancellation during automatic execution, partial failures, cleanup confirmation, redaction, concurrency, HTTP boundaries, and certificate setup. Mocked page checks cover collection, visible tokens, automatic results, Cancel, and token clearing. No current live proxy swap, new CA upload, payment, or Caddy deployment is claimed.

Historical evidence: on October 20, 2026, the earlier manual-checkpoint implementation at commit `c85deef` passed one real sandbox comparison (proxied approval, direct decline, both sessions `COMPLETED`) using the public fixture, an existing CA, and a temporary route-limited HTTPS merchant endpoint. That result does **not** validate this automatic refactor. Fresh live validation requires a separate explicit run request. Runtime captures and identifiers are excluded from this repository.

## References

- [Evervault Card Collection](https://docs.evervault.com/cards/card-collection)
- [Evervault Browser Tokens](https://docs.evervault.com/browser-tokens)
- [Browserbase Evervault integration](https://docs.browserbase.com/integrations/evervault/introduction)
- [Browserbase proxies and custom CA certificates](https://docs.browserbase.com/platform/identity/proxies)
- [Stagehand v4 browser configuration](https://docs.stagehand.dev/v4/configuration/browser)
- [Stagehand v4 logging](https://docs.stagehand.dev/v4/configuration/logging)
- [Caddy installation](https://caddyserver.com/docs/install)

This recipe is distributed under the cookbook's MIT license. It contains no proprietary fonts, private deployment assets, or captured runtime data.
