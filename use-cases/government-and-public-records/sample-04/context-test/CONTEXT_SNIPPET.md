# Browserbase Contexts for re:SearchTX — create, save, and reuse auth

The idea: **log in once**, save that session's cookies/localStorage into a
Browserbase **Context**, then attach the same `contextId` to every future session so
they load already-authenticated — skipping the OIDC redirect / WAF callback entirely.

Three steps: **create** the Context once → **capture** the login into it
(`persist: true` + close the session) → **reuse** it on every run.

> Validated end-to-end on re:SearchTX: a fresh session with a saved Context restored a
> full authenticated session (`sess_loggedIn=true`, valid `RSCH_JWT`) on a *different*
> Texas proxy IP — so the site is not IP/TLS-bound in a way that breaks reuse.

---

## 1. Create the Context (once)

Save the returned `id` — you reuse it on every run.

```ts
import Browserbase from "@browserbasehq/sdk";

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });
const context = await bb.contexts.create({ projectId: process.env.BROWSERBASE_PROJECT_ID! });
console.log("Save this:", context.id); // e.g. 66d9c16e-510b-477e-a16e-469b53ca31c3
```

No-SDK equivalent (raw REST — exactly what our test harness uses):

```ts
const res = await fetch("https://api.browserbase.com/v1/contexts", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-bb-api-key": process.env.BROWSERBASE_API_KEY! },
  body: JSON.stringify({ projectId: process.env.BROWSERBASE_PROJECT_ID! }),
});
const { id: contextId } = await res.json();
```

## 2. Capture / save the login into the Context

Open a session with `context: { id, persist: true }`, complete the login (here, by
hand in Live View), then **close the session — closing is what saves the Context.**

The stealth settings matter: re:Search sits behind **AWS WAF**, which advanced stealth
clears only with a **windows/mac fingerprint** (`os: "mac"`). A plain client gets HTTP
403. Pin a **US/Texas** proxy to match the expected geo.

```ts
import { chromium } from "playwright-core";

const session = await bb.sessions.create({
  projectId: process.env.BROWSERBASE_PROJECT_ID!,
  browserSettings: {
    context: { id: contextId, persist: true }, // persist:true → save changes on close
    advancedStealth: true,                      // required to clear the AWS WAF
    solveCaptchas: true,
    os: "mac",                                  // windows|mac fingerprint for the WAF
  },
  proxies: [{ type: "browserbase", geolocation: { country: "US", state: "TX" } }],
  region: "us-east-1",
  timeout: 1800, // keep alive long enough to finish the login
});

const browser = await chromium.connectOverCDP(session.connectUrl);
const page = browser.contexts()[0].pages()[0];
await page.goto("https://research.txcourts.gov/CourtRecordsSearch/ui/Home");

// → open the Live View URL, sign in fully, confirm you're INSIDE the app
//   (Browserbase dashboard → this session → Live View, or bb.sessions.debug(session.id))

await browser.close(); // ← THIS persists the authenticated state into the Context
```

Confirm it worked before trusting it: the `sess_loggedIn` cookie flips to `true` and a
populated `RSCH_JWT` appears once you're really signed in (vs `sess_loggedIn=false` on
the public `/ui/Home` bounce). Don't trust the URL alone — `/ui/Home` looks the same
signed-out.

## 3. Reuse the Context on every subsequent run  ← the part you asked about

Same `context: { id, persist: ... }` on a **fresh** session. It loads
already-authenticated; no login step.

```ts
const session = await bb.sessions.create({
  projectId: process.env.BROWSERBASE_PROJECT_ID!,
  browserSettings: {
    context: { id: contextId, persist: true }, // reuse the SAME id; persist:true keeps it fresh
    advancedStealth: true,
    solveCaptchas: true,
    os: "mac",
  },
  proxies: [{ type: "browserbase", geolocation: { country: "US", state: "TX" } }],
  region: "us-east-1",
});

const browser = await chromium.connectOverCDP(session.connectUrl);
const page = browser.contexts()[0].pages()[0];
await page.goto("https://research.txcourts.gov/CourtRecordsSearch/ui/dashboard");
// → you're signed in. Search / extract as the authenticated user. No OIDC, no WAF callback.
```

`persist: true` writes any refreshed cookies back so the Context stays current.
Use `persist: false` for a strictly read-only reuse that never mutates the saved state.

---

## If you use Stagehand instead of the raw SDK

Identical settings, passed through `browserbaseSessionCreateParams`:

```ts
const stagehand = new Stagehand({
  env: "BROWSERBASE",
  browserbaseSessionCreateParams: {
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    browserSettings: {
      context: { id: contextId, persist: true },
      advancedStealth: true,
      solveCaptchas: true,
      os: "mac",
    },
    proxies: [{ type: "browserbase", geolocation: { country: "US", state: "TX" } }],
    region: "us-east-1",
  },
});
await stagehand.init();
// ... drive / extract ...
await stagehand.close(); // persists when persist:true
```

## Gotchas worth knowing

- **Closing the session is the "save."** Nothing persists until the session ends with
  `persist: true`.
- **A Context is not permanent.** re:Search's `RSCH_JWT` lives ~12h; after that the
  saved login goes stale (`sess_loggedIn=false`, back to the public `/ui/Home`). Re-run
  the capture step to refresh. That's normal token expiry, not a reuse failure.
- **Keep the posture consistent** between capture and reuse — same `os` fingerprint and
  same proxy geo — so the restored session looks like the one that logged in.
- **Verify with the cookie, not the page.** `sess_loggedIn=true` is the deterministic
  signal that reuse worked; the SPA sometimes hasn't painted the signed-in chrome yet.
