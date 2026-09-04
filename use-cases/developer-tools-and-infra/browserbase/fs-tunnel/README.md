# bb-fs-tunnel

Browse files from your local machine inside a Browserbase cloud browser —
without uploading them anywhere, and without exposing them to the public.

Chrome on Browserbase blocks `file://` URLs by policy, and the Session Uploads
API only supports feeding files into `<input type=file>` elements. This tool
instead makes a chosen local directory *navigable as URLs* from your session:

```
cloud browser ──(request + secret header)──► https://xxx.trycloudflare.com
                                                      │
                                             Cloudflare tunnel
                                                      │
your machine: auth-gated read-only file server ──► your directory
```

- The file server binds to `127.0.0.1` only and is **read-only** (GET/HEAD).
- Every request must carry `X-Tunnel-Auth: <secret>` — a random UUID minted
  per run. Anyone else hitting the public tunnel URL gets **401**.
- CDP Fetch interception adds the secret only to requests for the exact tunnel
  origin and removes that header from every other request.

## Prerequisites

- Node.js 18+
- `cloudflared` (`brew install cloudflared` / [other platforms](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/))
- Env vars: `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`

## Setup

```bash
npm install
```

## Usage

Two terminals:

```bash
# Terminal 1 — share a directory (file server + tunnel + BB session)
node launch-fs.mjs --dir ~/some/folder
# wait for ---READY---

# Terminal 2 — authorize the session + get the live-view link
node attach.mjs
```

Open the live-view URL printed by `attach.mjs`, then type an explicit file path
such as `/report.pdf` in the original tab. Directory listing is disabled so a
request cannot enumerate private filenames.

Ctrl-C in terminal 1 tears everything down (releases the BB session, kills
the tunnel). Keep terminal 2 running while you use the session — it holds the
auth header; without it the session's requests get 401.

## Notes & caveats

- **Type URLs in the session's original tab.** The auth header is injected
  per-tab and only for the exact tunnel origin (scheme, host and port). A newly
  opened tab won't carry the secret (you'll see a 401). Redirect hops are checked
  separately; unrelated origins and resources never receive the injected secret.
- Sessions are created with `keepAlive: true` so they survive client
  reconnects — they bill until released, so Ctrl-C the launcher when done.
- Cloudflare terminates TLS at its edge, so Cloudflare is inside the trust
  boundary while the tunnel is up. The secret is never logged or persisted
  beyond a config file in your OS temp dir, and the server strips nothing —
  it simply refuses requests without the secret.
- Path traversal is guarded with canonical checks before and after a no-follow
  descriptor is opened. The descriptor identity must still match the canonical
  in-root file before any bytes are streamed. Directory requests are rejected.

## Local authentication tests

```bash
node --test tests/*.test.cjs
```

The browser test is opt-in. To run it with an installed Chrome executable:

```bash
COOKBOOK_TEST_CHROME="/absolute/path/to/chrome" node --test tests/auth.test.cjs
```

It starts two loopback HTTP servers and an isolated headless browser with a synthetic token. It verifies tunnel navigation, cross-origin images/frames, redirects away and back, unrelated navigation, new tabs, and removal of interception. No tunnel, Browserbase session, real secret or shared customer file is used. The CDP fixture also checks exact-origin matching and blocks a request when interception fails. Ctrl-C/SIGTERM removes interception before detaching, with a bounded shutdown fallback.
