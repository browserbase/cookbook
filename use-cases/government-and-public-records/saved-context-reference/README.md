# txcourts-context-test

Does a **Browserbase Context** let us log into **re:SearchTX** once, then reuse that
auth from a *fresh* session to search and extract court records — without ever
re-running the login? This harness exists to answer that one question honestly.

Portal: [research.txcourts.gov/CourtRecordsSearch/ui/Home](https://research.txcourts.gov/CourtRecordsSearch/ui/Home)
(Tyler Technologies re:Search).

## The problem we're working around

A example operator reported: login *completes*, but the post-login OIDC callback
runs through a **WAF-protected URL** that doesn't reliably hand the session into
the authenticated app — so the agent lands back on the public `/ui/Home` page.

The trap: **reaching `/ui/Home` is the failure, not success.** Unauthenticated
`/ui/Home` looks almost identical to the signed-in landing, so an agent that
declares victory on URL alone will report a broken login as "working" and burn
the operator's trial. This harness never trusts the URL — it looks for an explicit
signed-in signal (account name / Sign Out / saved searches) and treats
"on `/ui/Home` with a Sign In button" as **not authenticated**.

The plan: skip the flaky WAF callback entirely. Log in **once** interactively in a
Browserbase session, capture it as a Context, and attach that `contextId` to every
future run so sessions load already-authenticated.

## The gating question

Gov / Tyler-Odyssey sites sometimes bind a session to its **IP or TLS
fingerprint**, so a captured cookie may not re-authenticate from a new session.
**`verify` is the test that decides everything** — if a fresh session + the saved
Context lands authenticated, the Context approach is a real unblock and we hand the
`contextId` over. If it bounces to `/ui/Home`, the whole captcha-retry direction is
a dead end and we say so instead of wasting trial days on it.

## Commands

```bash
npm install
cp .env.example .env   # fill in BROWSERBASE_API_KEY

npm run probe          # 1. credential-free: reachability + WAF + page classify
npm run setup          # 2. interactive: log in via Live View → capture Context
BROWSERBASE_CONTEXT_ID=ctx_… npm run verify   # 3. THE test: fresh session reuse
BROWSERBASE_CONTEXT_ID=ctx_… npm run search -- "Smith"   # 4. search + extract
```

Each command takes an optional profile (`verified` default · `baseline`)
and writes JSON + a screenshot to `output/`:

```bash
npm run probe -- verified     # select Verified explicitly
npm run probe -- baseline     # Verified-disabled control
```

| Command | Needs creds? | What it proves |
|---|---|---|
| `probe`  | no  | The Verified profile reaches the WAF-protected site (a plain client gets HTTP 403); classifies the public page; checks for a guest search box. |
| `setup`  | human login in Live View | Drives one real login into the authenticated program; confirms it's *not* the `/ui/Home` bounce; persists auth into the Context. |
| `verify` | Context from `setup` | **The gating test.** Fresh session + same Context, `persist:false` — did it re-authenticate, or bounce? |
| `search` | Context from `setup` | Authenticated search + structured extract; refuses to pass off a guest/public bounce as results. |

## Why Verified + a macOS fingerprint

Verified uses a purpose-built browser fingerprint. For these targets, a **windows|mac** fingerprint is required, while Cloudflare
needs os ≠ windows, so **`os: "mac"`**
satisfies both. Proxies are pinned to a **US/Texas** exit IP. All configurable in
`.env`.

## Token TTL — recording a clean run

A captured Context is **not permanent**. re:Search's `RSCH_JWT` lives ~12h, so the
saved login goes stale (you'll see `sess_loggedIn=false` → `public_home`). That's a
normal token expiry, **not** a Context-reuse failure — the reuse proof from a fresh
session still holds.

For a clean recording, run the three steps **back-to-back within the token's life**:

```bash
npm run setup            # log in via Live View
npm run verify           # pre-flight: must print ✅ CONTEXT REUSE WORKS
npm run search -- "Smith"
```

`verify` is your health check: ✅ → record; `public_home` → re-run `setup` first.
`search` now **stops immediately** if the Context is stale (instead of guest-searching
a logged-out page), and a transient model-gateway `5xx` is retried automatically so a
blip doesn't kill the take.

## Honest scope

- `probe` is fully runnable now and is the live validation in this repo.
- `setup` / `verify` / `search` require a **real re:SearchTX account** and a human to
  complete the login in Live View (that's the whole point of the Context approach).
  The harness is built and wired; running them end-to-end needs the operator's (or a
  test) account.
- Stagehand v3 routes act/extract through Browserbase's **managed model gateway**, so
  no LLM provider key is required.

Built on the same Stagehand v3 + Browserbase pattern as the login coverage diagnostic.
