# Wait for CAPTCHA solving, then verify access

A minimal Stagehand v4 example. Requires Node.js 22+, pnpm 11, and a Browserbase API key.

```sh
cd examples/typescript/captcha-solving-wait-and-verify
pnpm install --frozen-lockfile
cp .env.example .env
# Set BROWSERBASE_API_KEY, TARGET_URL, and EXPECTED_SELECTOR in .env.
pnpm start
```

Use a unique CSS selector for post-challenge content, such as the search form. The `example.com` / `h1` defaults only demonstrate a page without a challenge.

The script listens before navigation, pauses while solving, and checks the element after `browserbase-solving-finished`. If missing, it revisits the original URL once in the same session. After `browserbase-solving-errored`, it keeps watching until the 90-second deadline. It prints `Page ready` or throws an error, then closes the billed session. No forms are submitted or human handoff attempted.

Plain solving is enough when the readiness check passes. For persistent blocks, add `proxies: true` to the launch options and `verified: true` inside `browserSettings`; Verified requires Scale plan access. Neither guarantees access or a reCAPTCHA v3 score. See [CAPTCHA solving](https://docs.browserbase.com/platform/identity/captcha-solving) and [Verified](https://docs.browserbase.com/platform/identity/overview#verified).

`pnpm typecheck` checks SDK signatures. Live CAPTCHA solving has not been verified.
