# Browser automation with Stripe Issuing sandbox

Confirm a fixed $10 USD order in an example-owned checkout with Browserbase, then simulate an authorization using Stripe Issuing test helpers. These examples do not purchase from external merchants or capture funds.

| Variant | Browser control | Setup |
| --- | --- | --- |
| Node.js | Playwright | [Node guide](node/README.md) |
| Stagehand | A checked Stagehand action and an independent page confirmation | [Stagehand guide](stagehand/README.md) |
| Python | Playwright | [Python guide](python/README.md) |

Each directory has its own dependencies and environment. Use an eligible cardholder in a Stripe sandbox with Issuing enabled, funded test balance, and authorization handling configured. Card creation is inactive by default; activation is an explicit opt-in and the returned card state is checked. The browser receives only the test order, never PAN, CVC, or billing identity.

The caller supplies a stable authorization idempotency key for one logical order. The scripts validate test card and holder state, confirm the browser receipt, and verify the resulting authorization. An approved pending authorization is not a completed purchase. Cleanup is attempted independently and failures produce a failing command status.

Cardholder setup uses a separate stable idempotency key and synthetic test identity. It verifies active test status and eligibility twice, and fails if requirements remain. Any required terms acceptance must be completed separately; the scripts do not fabricate acceptance. JavaScript dependency/type verification is also pending the local package-age cutoff; synthetic tests and local browser fixtures are not live provider verification.

See [Stripe sandbox testing](https://docs.stripe.com/issuing/testing?testing-method=with-code) and [test authorization parameters](https://docs.stripe.com/api/issuing/authorizations/test_mode_create).
