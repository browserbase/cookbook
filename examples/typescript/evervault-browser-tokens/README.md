# Card entry with Evervault Browser Tokens

A runnable Stagehand v4 + Browserbase + Evervault reference that compares two network paths using the same short-lived card tokens. It keeps the hosted collection UI and presenter checkpoints small enough to inspect and copy.

Use an **Evervault sandbox app and public test data only**: card `4242 4242 4242 4242`, CVC `123`, fixed expiry `12/34`. No purchase is made. Do not use real cards or customer data.

## What it demonstrates

```text
Local presenter page
  └─ Evervault-hosted iframe collects the test PAN/CVC
       └─ ciphertext → local backend → Evervault Browser Tokens API
            ├─ same tokens → Stagehand → Browserbase with Evervault proxy + CA
            │    └─ network swap → synthetic merchant receives fixture → approved
            └─ same tokens → Stagehand → direct Browserbase control
                 └─ unchanged tokens → same merchant → declined
```

Both sessions use the same region, viewport, exact destination, timeout, browser settings, and token values. The intentional network differences are the Evervault external proxy and its trusted CA. No model is needed: Stagehand uses deterministic locators for the known fixture.

The comparison proves the fixture's immediate response for that run. It does not prove settlement, compatibility with every checkout, or production reliability. Client-side validation, payment iframes, other destination hosts, and 3DS need separate integration work.

## Prerequisites

- Node.js **24.x** and npm **12.2.0** (or a compatible npm release supporting `min-release-age`).
- Your own Browserbase project/API key, with external-proxy and custom-CA support. The API key scopes certificate upload and browser sessions to your project; a separate project ID is not needed.
- Your own Evervault **sandbox** Team ID, App ID, server API key, and Browser Tokens access. Configure Card Collection to accept your local presenter origin if your app requires an origin allowlist.
- A domain you control with HTTPS access to this machine for the synthetic merchant. Remote Browserbase sessions cannot reach `127.0.0.1` on your computer.

The local presenter stays at `http://127.0.0.1:4173`. Only three merchant routes are exposed over HTTPS. You can study and test the code without credentials; credentials are required for setup and live execution.

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
| `PORT`                          | Local presenter port; defaults to `4173`. Update the proxy target too if changed.                                                          |

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

Every other public path returns `404`. The proxy preserves the public Host header; the application also rejects that host for presenter and API routes. Do not expose the entire application through a tunnel, change its loopback bind address, rewrite Host to the local presenter host, or forward `/api/*`.

Check the boundary before running the demo (these calls do not create sessions):

```sh
# Replace cards.example.com with CARD_TARGET_HOST.
curl --fail https://cards.example.com/mock-merchant/checkout
curl -i https://cards.example.com/api/config   # must be 404
curl -i https://cards.example.com/             # must be 404
```

## Run the comparison

```sh
npm start
```

Open **`http://127.0.0.1:4173`** using that exact origin. The API requires the local Host, same-origin requests, and a custom request header; it is not a public API.

1. Enter the public test PAN and CVC inside the Evervault-hosted iframe. The parent page receives only ciphertext; expiry is fixed separately.
2. Click **Create tokens & launch**. The secure collection frame is removed and local ciphertext references are cleared. The backend requests five-minute tokens with `permissions: [{ action: "decrypt", target: CARD_TARGET_HOST }]`.
3. Two **billable Browserbase sessions** open. Click **Enter tokens in both** within 45 seconds. Only token values enter their card fields.
4. Click **Submit both checkouts** within the next 45 seconds. The proxied request is swapped to the public fixture and approved. The direct request carries unchanged tokens and is declined.
5. Inspect both Live Views. A successful comparison holds for 30 seconds, then closes both sessions and clears the displayed tokens and Live View URLs.

**Stop & release**, checkpoint timeout, startup failure, and normal process shutdown all attempt cleanup. Token freshness is checked again before filling and before submission; submissions are never blindly retried. Each session also has a 240-second server timeout and `keepAlive: false`. If cleanup cannot be confirmed, the UI reports failure; check the Browserbase dashboard before another run. Keep the presenter and server open until cleanup completes. A forced process kill cannot execute cleanup code; the server timeout is the fallback. Reloading the page loses local UI ownership of a run; its checkpoint/session timeouts still apply.

The fixed merchant accepts only the published fixture and returns a constant approval/decline page. It never logs, persists, echoes, or places submitted values into URLs. Its public routes can be used by anyone who knows the hostname; they cannot launch sessions. Limit network exposure and remove the proxy when you finish.

## Security boundary

- **Collection:** PAN/CVC are entered in Evervault's hosted iframe. Do not replace it with parent-page inputs or server-side plaintext collection. Ciphertext is sent only to the local backend, then Evervault.
- **Token use:** Evervault returns format-preserving values and short-lived proxy credentials. Stagehand and Browserbase receive tokens. Proxy credentials and service keys remain server-side. This demo pins the returned proxy hostname to the `evervault.app` domain and fails closed for another domain.
- **Reveal destination:** Only your exact synthetic merchant hostname is allowed. Wildcard reveal permissions and certificate-error bypasses are not used.
- **Observability:** Browserbase recording/session logging and Stagehand logging are disabled. No raw provider errors, request bodies, CDP data, or proxy credentials are logged or returned. Temporary token values and private Live Views are intentionally visible only in the local presenter. Do not capture or share them.
- **Storage:** Run state stays in process memory. Terminal token/Live View fields are cleared; completed metadata expires from the store after ten minutes on subsequent access. There is no serverless cache, database, Context persistence, or replay export.
- **Plaintext destination:** The synthetic merchant runs in this same application and receives the known public fixture after the proxy swap. A production design must use a separately controlled merchant/PSP. This demo is not a PCI-compliance determination or a production payment service.

The Host/origin/header checks protect this local demonstration from accidental public exposure and drive-by browser requests. They are not multi-user authentication. Production use needs separate authentication, authorization, tenant isolation, rate limits, audit policy, secret management, and compliance review.

## Offline checks

```sh
npm run check
```

Tests use synthetic responses and mock every Browserbase/Evervault call. They cover the proxy/CA settings, exact-host outcomes, checkpoints, cancellation during startup, partial launch and attachment cleanup, token expiry, error privacy, HTTP boundaries, synthetic merchant, and environment-file permissions. No certificate is uploaded and no Browserbase session is created. Passing these checks is **offline evidence**, not a claim that the adapted live workflow has been validated.

Code map:

- `src/evervault.ts`: ciphertext → token request and response validation.
- `src/card-run.ts`: matched Stagehand sessions, deterministic card entry, result checks, and cleanup.
- `src/run-store.ts`: in-memory state, presenter gates, and cancellation.
- `src/server.ts`: local control API and synthetic merchant.
- `public/`: hosted collection UI and local Live Views.
- `scripts/setup.ts`: explicit certificate provisioning.

## References

- [Evervault Card Collection](https://docs.evervault.com/cards/card-collection)
- [Evervault Browser Tokens](https://docs.evervault.com/browser-tokens)
- [Browserbase Evervault integration](https://docs.browserbase.com/integrations/evervault/introduction)
- [Browserbase proxies and custom CA certificates](https://docs.browserbase.com/platform/identity/proxies)
- [Stagehand v4 browser configuration](https://docs.stagehand.dev/v4/configuration/browser)
- [Stagehand v4 logging](https://docs.stagehand.dev/v4/configuration/logging)
- [Caddy installation](https://caddyserver.com/docs/install)

This recipe is distributed under the cookbook's MIT license. It contains no proprietary font files or private demo deployment assets.
