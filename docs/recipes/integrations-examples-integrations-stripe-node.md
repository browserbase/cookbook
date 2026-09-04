# Stripe · node

Confirm an owned $10 USD checkout in the browser, then verify a Stripe Issuing sandbox authorization.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `integrations/examples/integrations/stripe/node`.
- Languages: typescript.
- Frameworks: @browserbasehq/stagehand.
- [Upstream setup and behavior](../../integrations/examples/integrations/stripe/node/README.md).
- [Dependency manifest `integrations/examples/integrations/stripe/node/package.json`](../../integrations/examples/integrations/stripe/node/package.json).
- [Source `integrations/examples/integrations/stripe/node/1-create-cardholder.ts`](../../integrations/examples/integrations/stripe/node/1-create-cardholder.ts).
- [Source `integrations/examples/integrations/stripe/node/2-create-card.ts`](../../integrations/examples/integrations/stripe/node/2-create-card.ts).
- [Source `integrations/examples/integrations/stripe/node/3-get-card.ts`](../../integrations/examples/integrations/stripe/node/3-get-card.ts).
- [Source `integrations/examples/integrations/stripe/node/4-make-payment.ts`](../../integrations/examples/integrations/stripe/node/4-make-payment.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd integrations/examples/integrations/stripe/node
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npx tsx 2-create-card.ts
npx tsx 3-get-card.ts
npx tsx 4-make-payment.ts
```

## Environment

[Environment template](../../integrations/examples/integrations/stripe/node/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `BROWSERBASE_PROJECT_ID` | [Browserbase](https://www.browserbase.com/settings). Selects the Browserbase project used for sessions. Non-secret. | `example-value` | Use the format described by the recipe. No default. |

### Conditional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/settings/keys). Authenticates requests to Anthropic. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys). Authenticates requests to OpenAI. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `STRIPE_API_KEY` | [Stripe](https://dashboard.stripe.com/test/apikeys). Authenticates requests to Stripe. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `STRIPE_TEST_AUTHORIZATION_KEY` | [Stripe](https://dashboard.stripe.com/test/apikeys). Provides the stripe test authorization key credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |
| `STRIPE_TEST_CARDHOLDER_KEY` | [Stripe](https://dashboard.stripe.com/test/apikeys). Provides the stripe test cardholder key credential or sensitive input. Secret. | `<set-locally>` | Must be non-empty when used. No default. |

### Optional

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `STRIPE_CARDHOLDER_ID` | [Stripe](https://dashboard.stripe.com/test/apikeys). Configures stripe cardholder id behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `STRIPE_ACTIVATE_TEST_CARD` | [Stripe](https://dashboard.stripe.com/test/apikeys). Configures stripe activate test card behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |
| `STRIPE_CARD_ID` | [Stripe](https://dashboard.stripe.com/test/apikeys). Configures stripe card id behavior for this recipe. Non-secret. | `example-value` | Use the format described by the recipe. No default. |


## Dependencies

Declared runtime dependencies from [integrations/examples/integrations/stripe/node/package.json](../../integrations/examples/integrations/stripe/node/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `@playwright/test` | `1.63.0` |
| `boxen` | `8.0.1` |
| `chalk` | `6.0.0` |
| `dotenv` | `16.6.1` |
| `stripe` | `22.6.1` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Requires an eligible Stripe sandbox cardholder, funded test Issuing balance, and configured authorization handling. Sandbox authorization is not an external purchase or capture.
- Cardholder setup rejects outstanding eligibility requirements. Complete any required terms acceptance separately; no acceptance is fabricated. Live provider behavior remains unverified.
- JavaScript SDK installation/typechecking remains pending the local package-age policy. Local Chrome tests use synthetic providers; Stagehand model execution remains unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/integrations/tree/b7bc81c6fd4e089ab0c0df2b82529b200739e458/examples/integrations/stripe/node) at commit `b7bc81c6fd4e089ab0c0df2b82529b200739e458`.

Related topics: [Agents and human handoff](../topics/agents-and-human-handoff.md), [Integrations and orchestration](../topics/integrations-and-orchestration.md).
