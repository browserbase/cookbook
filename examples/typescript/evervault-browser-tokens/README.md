# Card entry with Evervault Browser Tokens

A one-shot TypeScript reference for the [Browserbase Evervault quickstart](https://docs.browserbase.com/integrations/evervault/browser-tokens): **hosted card collection → Browser Tokens → one proxied Browserbase session → synthetic approval → cleanup and exit**.

Start with [index.ts](index.ts). It creates tokens, launches through Evervault's returned proxy with an explicit trusted CA, attaches Stagehand, fills tokens, submits once, verifies the exact HTTPS destination and approval, then releases the session. [evervault.ts](evervault.ts) contains configuration and the token request; [local.ts](local.ts) serves the collection page and synthetic merchant. No model is required.

Use **your own sandbox credentials** and only the public Visa fixture: number **`4242 4242 4242 4242`**, dummy CVC **`123`** (the three-digit security code), fixed expiry **`12/34`**. The number represents a public test card, not a real card. No purchase or real charge occurs. Never enter real cards or customer data.

## Setup

Requirements: Node.js **24.x**, npm **12.2.0** (or a compatible version supporting `min-release-age`), your own Evervault sandbox with Browser Tokens access, and your own Browserbase API key with external-proxy/custom-CA support. The key scopes sessions and uploaded certificates to your project; no separate project ID is needed. You also need reader-managed HTTPS exposure for the synthetic merchant: a remote Browserbase session cannot reach localhost on your machine.

From the cookbook root:

```sh
cd examples/typescript/evervault-browser-tokens
npm ci --ignore-scripts --min-release-age=7
test -f .env || cp .env.example .env
chmod 600 .env
```

Fill in your private `.env`:

| Variable                        | Purpose                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `EVERVAULT_TEAM_ID`             | Your public Team ID for hosted collection.                                               |
| `EVERVAULT_APP_ID`              | Your public sandbox App ID for collection and server authentication.                     |
| `EVERVAULT_API_KEY`             | Server-only Evervault sandbox key.                                                       |
| `BROWSERBASE_API_KEY`           | Server-only Browserbase key.                                                             |
| `BROWSERBASE_CA_CERTIFICATE_ID` | Trusted Evervault CA ID; required by `npm start`. Run setup below to obtain it.          |
| `CARD_TARGET_HOST`              | Your exact public merchant hostname, without scheme, wildcard, port, IP, or path.        |
| `PORT`                          | Loopback port; defaults to `4173`. Update the proxy target and local URL too if changed. |

`DEMO_RECORD_SESSION` defaults to `false` and accepts only `true` or `false`. Set it to `true` in your private `.env` only for debugging with the documented public fixture. This enables Browserbase video recording while keeping network/session logs disabled. Recordings can retain the temporary tokens visible in the merchant fields beyond their five-minute lifetime; keep recordings private and out of Git. Never enable this option with real cards or customer data.

If your Evervault app requires an origin allowlist, allow the local collection origin. Keep API keys out of the page, chat, logs, URLs, and Git.

### Trust the Evervault CA

```sh
npm run setup
```

The explicit setup helper reuses a configured certificate if it is accessible with your Browserbase key. Otherwise it downloads `https://ca.evervault.com`, validates that it is a currently valid CA, and uploads it to Browserbase. It prints `BROWSERBASE_CA_CERTIFICATE_ID=...`; **copy that assignment into `.env` yourself**. It does not rewrite files or launch sessions.

Browserbase's retrieval API returns metadata, so reuse does not attest to an existing certificate's contents. Verify that a reused ID is the Evervault CA you intend to trust. If setup fails, inspect your project's certificates before retrying: an upload may already have occurred.

### Expose only the merchant over HTTPS

Use a domain you control, with DNS pointing to your machine and the ports required by your HTTPS proxy available. This route-limited Caddy example belongs in a private Caddyfile outside this repository. Replace `cards.example.com` and set `CARD_TARGET_HOST` to the same domain. Run Caddy on the same machine as the loopback server; adapt the upstream port if needed.

```caddyfile
cards.example.com {
    @checkout {
        method GET
        path /mock-merchant/checkout
    }
    @authorize {
        method POST
        path /mock-merchant/authorize
    }
    handle @checkout {
        reverse_proxy 127.0.0.1:4173 {
            header_up Host {http.request.host}
        }
    }
    handle @authorize {
        reverse_proxy 127.0.0.1:4173 {
            header_up Host {http.request.host}
        }
    }
    handle {
        respond "Not found" 404
    }
}
```

Install Caddy using its official instructions, then validate and run your configuration:

```sh
caddy validate --config /path/to/your/Caddyfile --adapter caddyfile
caddy run --config /path/to/your/Caddyfile --adapter caddyfile
```

Preserve the public Host header. Do not expose `/`, `/api/*`, or the entire application through a tunnel; do not rewrite Host to the local origin. The app independently rejects public hosts for collection/API access. Do not enable body logging. The merchant needs only `GET /mock-merchant/checkout` and `POST /mock-merchant/authorize`; no stylesheet is required.

## Run once

```sh
npm start
```

Keep the process running. Open **`http://127.0.0.1:4173`** using that exact origin, enter the public number and CVC inside Evervault's hosted fields, then click **Continue** once. The local backend receives ciphertext. As soon as a session is created, the existing submission request returns an **Open in Browserbase** link. The same authenticated dashboard URL is printed in the terminal; it requires access to the session's Browserbase project and is not a bearer Live View or CDP connection URL. Open it to inspect the session and watch Live View while it is running. Short runs may finish before you open it; enable fixture-only recording beforehand if you need a replay. The page can show a sanitized pre-launch failure; final results and exit status remain in the terminal. There is no result page, polling API, or repeat-run control.

Before submitting the card, check your HTTPS boundary (these calls create no sessions):

```sh
# Replace the hostname with your CARD_TARGET_HOST.
curl --fail https://cards.example.com/mock-merchant/checkout
curl -i https://cards.example.com/api/config   # must be 404
curl -i https://cards.example.com/             # must be 404
```

The program requests tokens with a **300-second TTL** and `permissions: [{ action: "decrypt", target: CARD_TARGET_HOST }]`. This uses [Evervault's documented permission](https://docs.evervault.com/browser-tokens); the Browserbase quickstart currently shows `reveal`. It passes only tokens to deterministic Stagehand locators, with no model calls. `Stagehand.create()` attaches the browser context required by the pinned SDK.

Evervault's proxy replaces the submitted tokens with the original fixture on the request to the permitted merchant. The merchant accepts only the fixture and returns a synthetic approval. After verifying approval at the exact expected HTTPS URL, the program closes Stagehand/browser resources, requests session release, waits for `COMPLETED`, closes the local server, prints **`Success: synthetic approval and cleanup confirmed.`**, and exits zero. Failures or unconfirmed cleanup exit nonzero with a sanitized step/code such as `[NAVIGATION/OPERATION_FAILED]` or `[SESSION_LAUNCH/HTTP_429]`. Raw provider responses, stacks, ciphertext, tokens and proxy credentials are suppressed. To try again, invoke `npm start` again.

**Ctrl+C / SIGTERM** stops subsequent steps and waits for in-flight acquisition before releasing resources, including a session that finishes launching after cancellation. Cancellation cannot undo an already-started submission. A normal cancelled invocation exits `130` / `143` after cleanup; cleanup failure exits `1`. Do not force-kill the process if you want cleanup to run. Sessions also have `keepAlive: false` and a 240-second server timeout. If cleanup is unconfirmed, inspect Browserbase before retrying.

## Costs and boundaries

- Each completed live invocation starts **one billable Browserbase session** and submits one synthetic checkout. Cancelling before launch starts none. Setup contacts Evervault/Browserbase and may create a CA resource; it starts no sessions. HTTPS exposure is reader-managed infrastructure.
- Hosted fields encrypt PAN/CVC before the parent page or backend receives them. The handoff accepts one ciphertext submission per invocation, rejects plaintext/malformed values and duplicates, and clears its card values after token creation or failure. Ciphertext, Browser Tokens and proxy credentials are never printed or returned to the page. The local page receives only the account-authenticated session link or a sanitized pre-launch error. Keep runtime links and any explicitly enabled fixture recordings private; do not commit or distribute them.
- API keys and proxy credentials remain server-side. Browserbase recording is disabled unless `DEMO_RECORD_SESSION=true`; Browserbase session/network logging and Stagehand logging stay disabled in both modes. Requests use bounded timeouts, exact-host token/navigation restrictions, certificate validation, and expiry checks before filling/submitting. No certificate-error bypass or wildcard destination is used.
- Local collection/API access requires the loopback Host, matching Origin when present, and a custom API header; cross-site requests are rejected. These checks are not multi-user authentication. Public merchant routes cannot start sessions and never log, persist, echo, or redirect with submitted values. Remove HTTPS forwarding when finished.
- **The synthetic merchant receives the public fixture in plaintext.** This illustrates a network boundary and an immediate fixture response, not production readiness, PCI compliance, settlement, arbitrary merchant compatibility, or a production payment architecture. Real merchant/PSP separation, retention, 3DS, authentication, validation, and compliance need separate design and review.

## Verification

```sh
npm run check
```

Offline CA tests require `openssl` on PATH to generate disposable test certificates.

**The current session-link, recording-option and step-diagnostic changes are offline-tested.** A clean Node.js 24.19.0/npm 12.2.0 install passed typechecking and 44 tests. Tests cover configuration, explicit recording opt-in with network logging still off, session-link handoff, sanitized step/HTTP codes, token policies, concurrency, expiry, cancellation, partial failures, cleanup confirmation, HTTP isolation, and CA setup. Mocked browser checks cover the authenticated dashboard link, pre-launch failure display, and desktop/narrow layouts. No fresh live recording or replay has been validated for these changes.

Historical evidence: the earlier one-shot implementation at commit `427c50c` passed one real sandbox canary on October 21, 2026, using the public fixture and an existing CA: hosted collection, Browser Tokens, proxied approval, one session independently confirmed `COMPLETED`, and exit zero. A later user-driven run of that runtime failed before submission, with the session independently confirmed `COMPLETED`; its generic error did not establish a precise cause. These attempts do not validate the new observability changes or establish repeatability. New CA upload and Caddy deployment remain unverified. The earlier manual comparison canary at `c85deef` is separate historical evidence.

Additional live runs require an explicit run request. Credentials, real endpoint/session identifiers, runtime values, recordings and captures are excluded from the repository.

## References

- [Browserbase Evervault integration](https://docs.browserbase.com/integrations/evervault/introduction) and [quickstart](https://docs.browserbase.com/integrations/evervault/browser-tokens)
- [Evervault Browser Tokens](https://docs.evervault.com/browser-tokens) and [Card Collection](https://docs.evervault.com/cards/card-collection)
- [Browserbase proxies and custom CA certificates](https://docs.browserbase.com/platform/identity/proxies)
- [Stagehand v4 browser configuration](https://docs.stagehand.dev/v4/configuration/browser) and [page APIs](https://docs.stagehand.dev/v4/reference/page)
- [Browserbase Live View](https://docs.browserbase.com/platform/browser/observability/session-live-view) and [session replay](https://docs.browserbase.com/platform/browser/observability/session-replay)
- [Caddy installation](https://caddyserver.com/docs/install)

Distributed under the cookbook's MIT license. No proprietary fonts, deployment assets, or captured runtime data are included.
