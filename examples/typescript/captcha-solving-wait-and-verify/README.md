# Wait for CAPTCHA solving, then verify the page

A solver finishing does not mean the site has granted access. These Playwright TypeScript and Stagehand v4 examples listen before navigation, pause while Browserbase solves, and require a visible application element before reporting success.

## Run

Use Node.js 22+ and a Browserbase API key. No model key or local browser installation is needed; the Stagehand example uses deterministic browser methods.

From the repository root:

```sh
cd examples/typescript/captcha-solving-wait-and-verify
npm ci
cp .env.example .env
```

Fill in `BROWSERBASE_API_KEY`; the project is inferred from the key. Set `TARGET_URL` to an authorized target and `EXPECTED_SELECTOR` to a unique CSS selector for content accessible after the challenge (for example, the search form). Do not use the CAPTCHA widget, a generic page heading, or an element also visible on the blocked page. The supplied `example.com` / `h1` defaults are only a no-challenge smoke example.

Run either implementation:

```sh
npm run playwright
npm run stagehand
```

Each command creates a separate billed Browserbase session, prints its dashboard link, visits the target, and closes the session in `finally`, including on failure. Neither submits forms. Expected output is a JSON outcome such as `{"status":"ready","renavigated":false}`. `blocked` and `solving-timeout` exit with status 1. Credentials and connection URLs are not logged.

## Wait and verify

1. Register the listener before the first navigation. Playwright uses `page.on("console")` and `message.text()`; Stagehand v4 uses an awaited console subscription with the `Runtime.consoleAPICalled` CDP payload.
2. On `browserbase-solving-started`, stop further page actions and readiness checks while solving is active.
3. On `browserbase-solving-finished`, check the expected element. Allow three seconds for content to appear. If it remains missing, navigate to the original target URL **once in the same page and session**, preserving its cookies, then keep verifying. A second finish cannot cause another recovery navigation.
4. On `browserbase-solving-errored`, continue checking readiness and watching for a new challenge within the original deadline. Do not immediately reload or hand off.
5. At the deadline, report `solving-timeout` if a solve is active, or `blocked` otherwise. This example reports failure and closes the session; it does not implement human takeover. If you add takeover, retain the session and recheck that no solve is active before transferring control.

`CAPTCHA_TIMEOUT_MS` defaults to 90000 (allowed range: 1000–300000). The deadline covers initial navigation, solver retries, readiness checks, and the optional revisit; it does not reset on events. Session creation and cleanup are outside that budget. A deadline stops waiting, while `finally` closes the session to terminate pending browser operations.

Only proceed with application actions after `ready`. This is a gate for one page's navigation, not an automatic lock around a long-running agent. Register listeners before any later challenge-triggering action and gate subsequent actions too. Popups and other pages need their own listener and readiness predicate. A visible element is only as strong as the predicate you choose; it does not establish a successful form submission, accepted payment, or adequate reCAPTCHA v3 score. Use an application-specific result check for those workflows.

## Plain solving, proxies, and Verified

Start with `solveCaptchas: true` (set explicitly here) for supported challenges when the standard browser can reach the site. Plain solving is sufficient when the challenge completes and the application readiness check passes. It does not guarantee every Cloudflare, hCaptcha, or reCAPTCHA flow will accept the session.

For persistent access blocks, evaluate proxies and Verified with Browserbase support. `USE_PROXIES=true` enables proxies; `USE_VERIFIED=true` requests Verified. To test the combined configuration, enable both. Verified is a Scale plan feature requiring account access; it is not a prerequisite for plain solving. Proxies can improve success rates, while Verified addresses browser identity. Neither replaces the final page check or guarantees a reCAPTCHA v3 score.

References: [CAPTCHA solving and events](https://docs.browserbase.com/platform/identity/captcha-solving), [Verified](https://docs.browserbase.com/platform/identity/overview#verified), and [Stagehand v4 browser configuration](https://docs.stagehand.dev/v4/configuration/browser).

## Check locally

```sh
npm run typecheck
npm test
```

The offline tests cover readiness without events, finished-but-blocked pages, a single revisit, error followed by retry, active-solve deadlines, stale readiness results, and stalled operations. They do not prove a live provider solve or a particular site's access policy. The package overrides Stagehand's transitive Zod dependency to 4.6.7 to include its constrained-collection validation security fix.
