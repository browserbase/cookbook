# Browserbase Live View login starter

A small, self-contained example of the secure login flow you can host inside your own app.

The user signs into their account once, inside an embedded browser (the Live View). The
resulting authenticated session is saved into a reusable Browserbase **Context**. From then on,
automated runs reuse that Context to act on the account, with no need to log in again. The
operator enters credentials directly into the Live View iframe. This starter does not receive or
store the password in its own server code. Consult Browserbase's current service documentation and
your account settings for provider-side recording and retention behavior.

This repo is intentionally tiny: a small Express backend and one static page. The point is to show
the three backend calls and the iframe embed so you can lift them into your own stack.

## How it works

```
  Browser page                 Your server                    Browserbase
  ------------                 -----------                    -----------
  Open secure browser  ──────> POST /api/session
                                 createContext()         ───> new empty Context
                                 createLoginSession()    ───> session bound to Context
                                                              (persist: true, keepAlive: true)
                                 preNavigate(loginUrl)   ───> opens the login page
                                 liveViewUrl()           ───> interactive Live View URL
                       <──────  { liveViewUrl, ... }
  Show iframe(liveViewUrl)
  Operator logs in (incl. MFA) inside the iframe
  "Finished"           ──────> POST /api/finish
                                 releaseSession()        ───> ends session, login is
                                 waitUntilReleased()          flushed into the Context
                                 save context id
                       <──────  { contextId }
  Show "Connection saved"
```

Three Browserbase calls do the work (see `lib/browserbase.js`):

1. **Create a Context.** `bb.contexts.create({})` returns an empty store that will hold the login.
2. **Start a session bound to it.** `bb.sessions.create({ browserSettings: { context: { id, persist: true } }, keepAlive: true })`.
   `persist: true` writes the login back into the Context when the session ends; `keepAlive: true`
   keeps the session open while the user logs in.
3. **Get the Live View URL.** `bb.sessions.debug(sessionId).debuggerFullscreenUrl` is the
   interactive URL you put in the iframe `src`.

When the user is done, end the session (`bb.sessions.update(sessionId, { status: "REQUEST_RELEASE" })`)
and wait until it stops running. The login is flushed into the Context only on session end, so the
order matters. After that, the Context id is all you keep.

## Getting started

Requires Node 18 or newer.

```bash
npm ci
npm test
cp .env.example .env        # then add your BROWSERBASE_API_KEY
npm start
```

> **Add your Browserbase API key.** Open `.env` and set `BROWSERBASE_API_KEY` to your key from
> [browserbase.com/settings](https://www.browserbase.com/settings) (if it isn't set already). The
> server won't be able to start a session without it.

`npm start` opens http://localhost:3000 in your browser automatically (set `NO_OPEN=1` to skip this).
Click **Open secure browser**, sign into the test account in the embedded browser, then click
**I've finished logging in**. The user then sees a friendly confirmation screen. The saved Context
id (the thing your app keeps) is written to `.env` as `CONTEXT_ID` and logged to the server console.

By default the embedded browser opens on Platform A (`https://platform-a.example.invalid/us/en`), matching the demo
repo. Set `START_URL` in `.env` to point it at whichever account the user is connecting (Platform A,
Platform B, or wherever the account lives).

## Integrating into your own app

The two endpoints in `server.js` are plain HTTP and framework-agnostic. To embed this in your app:

- **Backend:** copy the logic from `POST /api/session` and `POST /api/finish` (the helpers live in
  `lib/browserbase.js`). They only need `BROWSERBASE_API_KEY`.
- **Frontend:** render the Live View URL in an iframe. The key attributes (from `public/index.html`):

  ```html
  <iframe
    src="<liveViewUrl>"
    sandbox="allow-same-origin allow-scripts allow-forms"
    allow="clipboard-read; clipboard-write"
  ></iframe>
  ```

  The iframe is **interactive** (no `pointer-events: none`) so the user can type their
  credentials and MFA code.
- **Storing the Context id:** this demo writes it to `.env` for convenience. In production, store it
  in your database, keyed to the user, and pass it to your automated runs.

## Security notes

- The user types their own credentials directly in the embedded browser. Your server never sees
  or handles the password, only the resulting authenticated session.
- The login is saved into the Context only when the session ends, which is why `/api/finish` releases
  the session and waits before returning.
- The Context id is the only thing you persist. Treat it like any other per-user secret.

## Config

| Variable | What it does |
| --- | --- |
| `BROWSERBASE_API_KEY` | Your Browserbase key. The only required credential. |
| `START_URL` | The page the embedded browser opens on. Defaults to Platform A (`https://platform-a.example.invalid/us/en`), matching the demo repo. |
| `PORT` | Local server port (default `3000`). |
| `CONTEXT_ID` | Written automatically after a successful login. |

## Notes

- The pre-navigation step (opening the login page for the user) uses `playwright-core` to connect
  to the session briefly and navigate. It's optional. If you'd rather the user navigate inside the
  Live View themselves, remove `preNavigate` from `server.js` and drop the `playwright-core` dependency.
- This uses the Browserbase SDK directly, so there's no agent or model key involved. It's only the
  login and Context piece.
- The "finished" step here is a manual button. You could instead watch for a successful login (for
  example, a redirect to the account dashboard) and advance automatically.

### Local session ownership

The starter binds to 127.0.0.1 and accepts local host/origin headers only. Session creation returns a random finish token; the browser keeps it with the session and sends it when finishing. The server checks the token and exact context/session pair before releasing or saving. A successful finish consumes that authorization. Restarting the server clears pending ownership records, so create a new login session after restart. This local demo does not provide multi-user hosted authentication.
