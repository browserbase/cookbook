# Tax portal OTP demo

Example demonstrating a mock tax portal, email OTP delivery through Resend, and browser-based Gmail retrieval. It sends real email when run with working credentials. It is not a production authentication implementation.

## Install and configure

Run commands from this package directory; do not install dependencies at the cookbook root.

```bash
npm install
cp .env.example .env
```

Set `RESEND_API_KEY`, `FROM_EMAIL` (an allowed Resend sender), `USER_EMAIL` (the Gmail inbox receiving the message), `BROWSERBASE_API_KEY` and `OPENAI_API_KEY`. The automation currently selects `openai/gpt-4o`. Do not commit the environment file or browser context identifiers.

The package pins Stagehand 4.0.2. Installation and the full email/browser workflow have not been independently verified for this migrated package. Known work remains in OTP selection, SDK compatibility, document delivery, and resource cleanup; the setup below does not certify those paths.

## Portal reachability

`npm run server` binds to `127.0.0.1:3000` by default (`PORT` overrides the port). Open `http://localhost:3000` and use the illustrative account `demo_agent` / `demo123`. These fixed demo credentials are shown on the login page; there is no real county account database. Access to the mock document additionally requires the emailed code in that same browser session.

`npm run automate` launches a Browserbase browser on another machine. Its `localhost` is not your development computer. Set `PORTAL_URL` to the HTTP(S) origin of a controlled deployment or approved protected tunnel that the remote browser can actually reach, with no path, credentials, query, or fragment. Keep that endpoint and the underlying server running for the entire automation. The script rejects missing/loopback origins before creating a session; this is configuration validation, not a reachability test.

The server also uses `PORTAL_URL` as its exact canonical origin for Host and POST Origin checks. Your approved tunnel or reverse proxy must preserve that Host header. HTTPS origins produce Secure cookies; forwarded headers cannot change that setting. Set `HOST` to an explicit IP address only when the deployment requires a different listening interface. Non-loopback binding requires an explicit HTTPS `PORTAL_URL`. A URL and the publicly documented demo password do not protect a deployment: keep an external access boundary around this fixed-mailbox demo. Use the same hostname throughout the flow; `localhost` and `127.0.0.1` have different cookies.

`npm run automate:local` is a separate experimental runner that uses a newly launched local browser and hard-coded port 3000. It does not automatically inherit your everyday browser's Gmail profile and is not a replacement for the cloud-context setup below.

## Set up Gmail in a Browserbase context

A desktop Gmail login does not transfer into a Browserbase session. The remote automation requires `BROWSERBASE_CONTEXT_ID` from a Browserbase session where you signed into the receiving inbox.

1. Set the Browserbase credentials and project in `.env`, then run `npm run setup-gmail` (this invokes `setup-gmail-context.ts`).
2. Save the printed context ID. Open the printed session link and sign into the Gmail inbox configured as `USER_EMAIL` inside that remote browser.
3. Press Enter in the setup terminal. The current script disconnects its Playwright client and prints a success message; that message does not independently verify session termination or completed context persistence.
4. Ensure the setup session has ended through Browserbase's session controls, then allow a few seconds for context synchronization. Do not run setup and automation against the same context concurrently.
5. Set `BROWSERBASE_CONTEXT_ID` in `.env` to the saved ID. Later automation passes that exact ID with `persist: true`. Gmail can still expire or reject the login, so confirm authentication rather than treating the context ID as proof.

Browserbase documents the create-context, log-in, end-session, synchronize, and reuse sequence in its [Contexts guide](https://docs.browserbase.com/platform/browser/core-features/contexts).

## Email response handling

The server activates a generated code only after Resend returns a message ID without an error. Provider rejection or malformed acceptance returns HTTP 502; missing recipient configuration returns 503. An older concurrent request cannot replace a newer active code. Logs report provider acceptance without printing the code or recipient. Acceptance does not prove inbox delivery. Overlapping requests from one session return 409 before another email is attempted. Delivery that outlives its session or a login replacement cannot activate a code. HTTP delivery waits at most 30 seconds; a late provider response cannot revive the timed-out challenge.

Each accepted challenge has a fresh request ID shared by its email subject/body and the owning session's verification page. Only accepted, still-active challenges expose this matching metadata; no OTP is returned in it. Both runners confirm this metadata before leaving the portal, search by sender and request-specific subject, then require one matching rendered message with the exact request ID and one labelled six-digit code. They confirm the active request again on return. Duplicate matches, unsupported layouts, unrelated messages, and ambiguous or malformed code fields fail closed. Search uses Gmail's [documented sender and subject operators](https://support.google.com/mail/answer/7190?hl=en); search results alone are not verification. OTP entry now uses a single matching input through the browser locator API, without putting the code in a model instruction.

The Gmail adapter currently targets the rendered desktop mail list and expanded message layout. It ignores hidden text and quoted replies and never scans the full page for arbitrary numbers. Its DOM reader has been exercised in isolated Chrome against synthetic Gmail-shaped HTML with all requests intercepted; real Gmail layout compatibility and the full email/browser flow remain unverified. A changed layout stops retrieval instead of broadening the search. Model assistance is used only to submit the search query, not to extract or type the code.

`test-gmail-otp.ts` now requires `PORTAL_URL` and a Browserbase context retaining an existing active portal challenge and Gmail login. It first reads the owning portal's accepted request; it cannot inspect arbitrary inbox codes. It reports only whether one matching code was found, without consuming it. Keep the same portal process running and the challenge unexpired.

## Session and document boundary

An opaque host-only HttpOnly cookie identifies each browser session. `SameSite=Lax` allows the remote runner's top-level GET back from Gmail. Every POST form includes a session-bound CSRF token. Login and successful code verification rotate the cookie and invalidate the previous identifier; rotation does not reset the owner's lifetime or limits.

- A session lasts at most 30 minutes. Codes last at most 10 minutes after provider acceptance, capped by that session deadline, and can be used once. Verified document access lasts at most 10 minutes, also capped by the original session deadline.
- Five incorrect submissions exhaust a code, including malformed values. Ten failed verifications exhaust the session's verification allowance.
- Resends require 60 seconds between attempts, with at most five attempts per logical session. Login rotation preserves these limits. Failed deliveries count toward them.
- A process-wide limit of 20 email attempts per 10 minutes prevents new cookies from bypassing the fixed mailbox limit. There are at most 1000 active sessions and 20 unresolved provider calls. A provider timeout does not release its capacity until the underlying call settles; a stuck provider can therefore temporarily stop new sends.

Both `/documents` and the exact `/public/tax-statement-2024.pdf` GET/HEAD route require a verified session. Responses use `Cache-Control: no-store`; there is no public static directory mount. The package includes a deterministic, one-page synthetic statement for demo parcel `DEMO-0001`, with no payment due. It contains no personal data and is not a real bill or public record. Rebuild it with `python3 scripts/generate-statement.py`; the generator uses only Python standard-library code. The protected route serves the exact fixture bytes after verification. After verification, each runner fetches the exact document link through its owned browser page using that session's cookies. It rejects redirects, non-PDF responses, empty or oversized bodies, incomplete responses, and bytes that differ from the packaged synthetic fixture. The request has a 15-second deadline and a 1 MiB cap. The resulting file is saved under a fresh `downloads/statement-*` directory and read back before success is reported; existing files are not overwritten. These local artifacts are ignored by Git and created with owner-only directory/file permissions.

State is in memory for one server process. Restart logs everyone out; multiple workers do not share sessions or quotas. This is an email-verification example for a configured demo mailbox, not a production identity service. Protect derived artifacts because they may contain session or mailbox data.

## Local verification

With this package's dependencies installed, use Node 24.19.0 or newer and Python 3 (for the deterministic PDF fixture check):

```bash
node --test tests/*.test.cjs
```

The tests load the complete app and real Express routes, use independent cookie jars, inject synthetic provider results, and serve a temporary synthetic PDF. They never import startup/dotenv or contact Resend, Gmail, Browserbase, or a county portal. They cover authorization, code expiry and replay, CSRF and origin checks, session rotation, send/attempt/capacity limits, late provider outcomes, and the real 30-second response timeout. Remote configuration has a separate preflight test suite. The synthetic portal login, emailed-code submission using an injected local delivery transport, and authenticated PDF retrieval/save were also exercised in isolated Chrome with non-loopback requests blocked. Full recipe installation and the real Browserbase/Gmail/email flow remain unverified.

## Run

Keep the mock portal and the protected reachable endpoint active. With `PORTAL_URL` and the saved context configured:

```bash
npm run automate
```

The intended sequence is portal login, requesting an OTP email, reading that email in Gmail within the same remote session, returning to the portal, and downloading a mock document. A successful final report includes the saved synthetic file path, byte count and SHA-256 only after artifact verification and browser cleanup. Provider acceptance remains distinct from inbox delivery. No cloud sessions or email were sent as part of the setup-documentation checks.

Both runners now own the launched browser before initializing Stagehand. They attempt Stagehand disposal and browser closure independently, surface workflow/cleanup failures as a nonzero exit, and no longer attach a second client through undocumented SDK CDP fields. These lifecycle paths are covered by synthetic execution tests; remote release and Gmail context persistence were not exercised.

The download check intentionally expects the packaged synthetic fixture, not an arbitrary tax document. If you regenerate or adapt it, keep the server and runner copies in sync and revalidate the document. The included fixture was independently parsed as a valid one-page PDF.
