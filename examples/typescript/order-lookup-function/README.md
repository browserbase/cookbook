# Order lookup for an AI support agent

Turn the nopCommerce merchant admin UI into a read-only tool: give the Function an order number, and receive payment, fulfillment and shipping status plus a Browserbase session replay. An AI support agent can use this result to answer “Has my order shipped?” without receiving the portal credentials.

This example uses the public [nopCommerce admin demo](https://admin-demo.nopcommerce.com/login), real authentication, and sample orders. It does not change orders, issue refunds, or contact customers. nopCommerce also offers APIs; this demonstrates integrating through an existing UI, not a claim that nopCommerce has no API.

## Setup

Use Node.js 24, npm, and a Browserbase project with Functions, Secrets, and Model Gateway access. Browser and model usage are billed to your project. No separate model-provider key is needed.

```sh
npm install -g browse
cd examples/typescript/order-lookup-function
npm ci --ignore-scripts
browse cloud extensions upload node_modules/@browserbasehq/stagehand/dist/assets/stagehand-extension.zip
```

Put the returned extension ID in `index.ts` in place of `REPLACE_WITH_UPLOADED_STAGEHAND_EXTENSION_ID`. Configure `BROWSERBASE_API_KEY` in your shell for CLI commands. The extension ID is project configuration, not a credential.

## Publish and attach Secrets

```sh
npm run typecheck
browse functions publish index.ts

browse cloud secrets create BROWSERBASE_API_KEY
browse cloud secrets create NOPCOMMERCE_EMAIL
browse cloud secrets create NOPCOMMERCE_PASSWORD
```

Enter values at the interactive CLI prompts. The demo login page publishes its current admin credentials; use those for the two nopCommerce Secrets. Never reuse your personal account password. If the API-key Secret already exists, reuse its ID from `browse cloud secrets list`.

Attach each Secret ID to the Function ID returned by publish:

```sh
browse functions secrets attach <function-id> <api-key-secret-id>
browse functions secrets attach <function-id> <email-secret-id>
browse functions secrets attach <function-id> <password-secret-id>
browse functions secrets list <function-id>
```

Secrets arrive through `context.secrets`. Credentials never appear in invocation parameters or AI instructions. Stagehand observes the login button before Playwright fills credentials, then extracts order details after login. Playwright handles native interactions because Stagehand 4.1.0 native locators exhibited extension-world readiness failures in this environment.

## Invoke

The default demo data includes orders 1–5. Order 1 is useful for the “paid, but not shipped” support scenario. Other visitors can change the shared demo, which resets hourly, so inspect the returned data rather than assuming a fixed result.

```sh
browse functions invoke <function-id> --params '{"orderId":"1"}'
```

Or start an invocation over HTTP:

```sh
curl -X POST "https://api.browserbase.com/v1/functions/<function-id>/invoke" \
  -H "x-bb-api-key: $BROWSERBASE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"params":{"orderId":"1"}}'

curl "https://api.browserbase.com/v1/functions/invocations/<invocation-id>" \
  -H "x-bb-api-key: $BROWSERBASE_API_KEY"
```

Poll until the invocation finishes; its `results` field contains the business outcome. `COMPLETED` alone does not mean an order was found.

Illustrative result:

```json
{
  "status": "found",
  "order": {
    "orderId": "1",
    "orderStatus": "Processing",
    "paymentStatus": "Paid",
    "shippingStatus": "Not yet shipped",
    "orderTotal": "$1,855.00",
    "trackingNumber": null,
    "trackingUrl": null
  },
  "replayUrl": "https://www.browserbase.com/sessions/<session-id>"
}
```

An agent can answer: “Your order is paid and being processed, but it has not shipped yet. No tracking information is available.” The Function does not invent a delivery date or reason for the delay.

## Behavior and limits

- `orderId` must be a positive integer represented as a string, up to nine digits. Invalid parameters may be rejected by the Functions schema before the handler runs.
- `unavailable` identifies the failed step without returning raw SDK errors. The shared portal returns to the order list for an unknown order, without an explicit not-found message; this is reported as `unavailable` at `lookup`, not as proof that an order does not exist.
- The portal origin is fixed; callers cannot redirect credentials to another URL. Missing Secrets stop execution before login.
- Structured extraction is model-generated, with a requested-order match check. It is not an authoritative accounting record. Tracking fields remain null when not displayed on the order page.
- Recordings are enabled. Returned JSON omits customer contact and payment details, but Stagehand processes page content and recordings can contain the sample customer's information. Use appropriate access controls before adapting to production.
- This is an authenticated backend tool, not a public order-status endpoint. A production agent must authorize the customer and order before calling it; an order number alone is not proof of ownership.
- Shared-demo availability and Cloudflare checks can vary. The Function uses a Browserbase proxy and bounded waits; it cannot guarantee third-party availability.

For local development, copy `.env.example` to `.env`, populate the same three values, and run `npm run dev`. Local development uses hosted browser/model resources; attached cloud Secrets are not automatically loaded locally. Never commit `.env`.

## Verification

On October 19, 2026, the published Function logged into the public demo without MFA and returned order 1 as Processing / Paid / Not yet shipped, totaling $1,855.00, with null tracking fields. An invocation with `../1` returned `invalid_input` before login. This validates the tested deployment and sample data, not future shared-demo availability.

The package installs independently from its lockfile; typechecking passed under Node.js 24.19.0. Repository structure, generated catalog, and all 66 repository tests passed.
