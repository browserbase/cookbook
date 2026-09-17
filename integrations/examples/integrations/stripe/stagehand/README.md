# Stagehand and Stripe Issuing sandbox

Use Stagehand through Browserbase to confirm an order in an example-owned checkout, then simulate its authorization with Stripe Issuing test helpers. The order is fixed at $10 USD. This does not purchase anything from an external merchant or capture funds.

## Prerequisites

- Node.js compatible with the package dependencies and an installed package manager.
- A Browserbase project and API key.
- An OpenAI API key for the Stagehand model.
- A Stripe sandbox with Issuing enabled, test Issuing balance funded, and an active test cardholder whose requirements are satisfied.
- Test authorization handling configured for that sandbox. Spending controls must permit the example's charitable fundraising merchant category.

Install dependencies from this directory with `npm install`. The package declares Stripe 22.6.1; verification of that fresh JavaScript installation is pending because it is inside the local seven-day package-age cutoff. The full package build is not yet verified.

## Configure the environment

Create a local `.env` file from `.env.example` and add these values:

```dotenv
STRIPE_API_KEY=sk_test_replace_me
STRIPE_CARDHOLDER_ID=ich_replace_me
STRIPE_CARD_ID=ic_replace_me
STRIPE_TEST_AUTHORIZATION_KEY=cookbook-order-001
BROWSERBASE_API_KEY=replace_me
OPENAI_API_KEY=replace_me
```

Use real IDs from your sandbox. The placeholder IDs are not usable. `STRIPE_TEST_AUTHORIZATION_KEY` identifies one logical test order: retain it when retrying an uncertain request and choose a new key for a new order. Never put secret keys, card numbers, or personal data in this key.

## Create and activate a test card

Use an existing eligible sandbox cardholder, or create a synthetic test individual:

```sh
STRIPE_TEST_CARDHOLDER_KEY=cookbook-holder-001 npx tsx 1-create-cardholder.ts
```

Retain this key when retrying the same creation attempt. The helper validates test mode, active status, and outstanding requirements on both creation and retrieval before reporting an ID. It does not submit terms acceptance. If your account requires acceptance or other information, complete those requirements through Stripe before continuing; active status alone is insufficient. Copy the verified ID into `STRIPE_CARDHOLDER_ID`.

```sh
npx tsx 2-create-card.ts
```

Creation explicitly requests an inactive virtual card. To opt into activation during creation:

```sh
STRIPE_ACTIVATE_TEST_CARD=true npx tsx 2-create-card.ts
```

The creator retrieves the activated card and checks its identity, cardholder, test mode, and status. Copy that ID into `STRIPE_CARD_ID`. Rerunning creation can create another card, so inspect existing state after a failure. An active status alone does not prove that authorization will be approved.

## Inspect the card

```sh
npx tsx 3-get-card.ts
```

The CLI reports only ID, status, mode, and last four digits. Its helper checks card metadata and cardholder eligibility before expanding sensitive test-card fields, then rechecks the response. The checkout example does not call this helper, request PAN/CVC, or put payment details into model instructions.

## Simulate an authorization

```sh
npm start
```

The `index.ts` runner verifies test configuration and card eligibility before allocating the browser. It opens its own checkout fixture and asks Stagehand to confirm the fixed order on that specific page. Both the action result and the independently read page confirmation must pass. The fixture contains no card number, CVC, billing identity, or external merchant connection.

Only a matching browser confirmation permits a request to Stripe's test authorization helper. The response must match the test card, holder, amount, and currency, be approved, and remain pending. A decline or mismatched response fails the command. Approval is an authorization result, not capture or purchase completion.

The Browserbase session has a five-minute lifetime. Browser disconnect and Browserbase session release are attempted independently. A cleanup failure also fails the command, even if the authorization was approved. Inspect the sandbox and reuse the same idempotency key when retrying an uncertain result.

## Verification and limits

Creator and retrieval tests use synthetic API responses. Checkout verification passed 23 source-function cases, including a local Chrome fixture driven through a synthetic action adapter. The live Stagehand model was not executed. No Browserbase session, Stripe card, activation, authorization, or capture was performed during cookbook verification. Live provider behavior and the complete JavaScript dependency build remain unverified.

Stripe sandbox Issuing cards cannot make external purchases. The earlier external donation checkout has been replaced here. All three variants use the same controlled sandbox lifecycle.

See [Stripe Issuing sandbox testing](https://docs.stripe.com/issuing/testing?testing-method=with-code), [test authorization parameters](https://docs.stripe.com/api/issuing/authorizations/test_mode_create), and [card status requirements](https://docs.stripe.com/api/issuing/cards/create).
