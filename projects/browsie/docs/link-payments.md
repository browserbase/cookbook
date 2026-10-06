# Stripe Link Agent Wallet payments

Browsie can use the official Stripe Link Agent Wallet from its Eve agent. This is an optional
feature. It does not store a card in the Browsie vault.

The Link CLI is the setup and account-management interface. Browsie's runtime does not launch a
shell command. It uses Stripe's native Eve integration and SDK so Eve can enforce approvals and the
server can keep payment credentials out of model-visible tool results.

## Design

The official `@stripe/link-integrations-eve` extension supplies wallet and spend-request tools. The
official `@stripe/link-sdk` retrieves an approved one-time card only inside the secure checkout tool.

```text
user confirms purchase
        |
Eve approves create_spend_request
        |
Link approval URL -> user authorizes the exact spend
        |
link__secure_checkout asks for Eve approval
        |
server retrieves one-time card -> Stagehand fills checkout -> browser verifies success
```

Browsie overrides `retrieve_spend_request` so the model can read status but cannot request a card or
payment token in a normal tool result. It disables Link financial-history and insight tools because
they are outside the payment example. `link__secure_checkout` checks that the request is approved,
checks the merchant host, fills the one-time card, submits once, and returns only a redacted status.

The secure checkout accepts only the merchant host from the approved spend request. For a
Stripe-hosted checkout, create the request with the exact `checkout.stripe.com` checkout URL. Add
another payment host only after you define and test a strict merchant-binding rule for that host.

## Setup

Link Agent Wallet is currently available for supported Link accounts. Follow the official
[Link CLI repository](https://github.com/stripe/link-cli) to install the CLI, sign in, and create the
wallet authorization. Put the resulting server access token in the Browsie server environment:

```bash
LINK_ACCESS_TOKEN=<server-only-token>
```

Do not paste this token into chat and do not commit it. Static-token mode is suitable for this
single-user reference application. A multi-user service must use per-user OAuth, durable encrypted
grant storage, tenant isolation, revocation, and audit controls.

## Checkout flow

1. Browsie inspects the checkout and verifies the final merchant, items, currency, and total.
2. It creates a card spend request. Eve asks the user to approve the tool action.
3. Browsie sends the Link approval URL and waits for the user.
4. It checks the same request until Link reports `approved`.
5. It inspects the payment form and calls `link__secure_checkout`. Eve asks for approval again.
6. The server retrieves the one-time card, fills the exact fields, submits once, and checks the
   required success selector.
7. Browsie reports success only when the page proves it. An unclear response must be inspected
   before any retry.

The first approval covers creation of the exact Link spend request. Link approval authorizes that
spend. The final Eve approval lets the user review the exact browser submission. This reference
keeps all three steps visible because payments are a high-impact action.

## Limits

- The included secure checkout supports a combined expiry field or separate month and year fields.
- It can fill an optional cardholder name and postal code from the one-time card billing address.
- Complex address forms, unusual payment iframes, and non-card Link credentials need a separate,
  tested secure adapter. Do not send these credentials through the general `run` tool.
- This reference does not expose Link shipping-address, financial-history, balance, or insight
  tools. Add them only with an explicit private-data retention and access-control design.
- A successful form submission does not prove settlement. The merchant page is the immediate source
  of truth; later payment state can need a merchant or Link status check.
