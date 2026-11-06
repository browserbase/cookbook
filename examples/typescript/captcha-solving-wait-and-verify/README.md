# Wait for CAPTCHA solving, then verify the page

A finished solve does not guarantee access. This single-file Stagehand v4 example waits for Browserbase's solver, checks for your application element, and revisits the original URL at most once in the same session.

## Run

Use Node.js 22+ and a Browserbase API key. No model key or local browser is needed.

```sh
cd examples/typescript/captcha-solving-wait-and-verify
npm ci
cp .env.example .env
# Fill in .env, then:
npm start
```

Set `BROWSERBASE_API_KEY`, `TARGET_URL`, and `EXPECTED_SELECTOR`. Choose a unique CSS selector for content accessible after the challenge, such as the search form—not the CAPTCHA widget. The `example.com` / `h1` defaults only demonstrate a page without a challenge.

The script creates a billed session, prints its dashboard link and solver events, and prints `Page ready` on success. It reports failure with exit code 1 and closes the session on either outcome. It does not submit forms.

## How it works

- Subscribe to console/CDP events before navigation. Pause while `browserbase-solving-started` is active.
- After `browserbase-solving-finished`, check the expected element. If still missing after three seconds, revisit the target once in the same page and session, then keep checking.
- After `browserbase-solving-errored`, watch for another challenge within the original 90-second deadline.
- At the deadline, report failure. If a solve is active, report that state without handing control to a human.

This covers one page's navigation. Later actions and popups need their own readiness checks. A visible form does not prove a successful submission or an adequate reCAPTCHA v3 score.

## Solving, proxies, and Verified

Plain solving is enough when the supported challenge completes and your readiness check passes. For persistent blocks, evaluate `USE_PROXIES=true` and `USE_VERIFIED=true` with Browserbase support. Proxies can improve success rates; Verified addresses browser identity and requires Scale plan access. Neither guarantees access or replaces the page check.

See [CAPTCHA solving](https://docs.browserbase.com/platform/identity/captcha-solving) and [Verified](https://docs.browserbase.com/platform/identity/overview#verified).

`npm run typecheck` checks SDK signatures. No live CAPTCHA solve has been verified. The Zod override includes the transitive dependency's security fix.
