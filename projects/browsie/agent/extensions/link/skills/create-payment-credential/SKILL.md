---
name: create-payment-credential
description: Create and use an approved Stripe Link one-time card for a browser checkout.
license: MIT
metadata:
  author: Browserbase
  url: https://github.com/stripe/link-cli
---

# Pay with Stripe Link

Use this skill when the user asks Browsie to buy something or pay in a browser checkout.

1. Inspect the cart and checkout. Verify the merchant, items, quantity, shipping choice, currency,
   and final total. Do not create a spend request while any of these facts are missing.
2. Call `link__retrieve_user_info` if wallet status or limits are not known. Call
   `link__list_payment_methods` only when the user asks for a specific payment method. Show only
   the minimum useful payment-method detail.
3. Call `link__create_spend_request` with `credential_type: "card"`, the exact amount in the
   currency's minor unit, merchant name and URL, line items, totals, and a clear context of at least
   100 characters. Keep `request_approval` enabled.
4. Show the returned Link approval URL. Stop and wait for the user to approve it. Link approval is
   separate from Eve approval.
5. Use `link__retrieve_spend_request` to check the same request. Do not create a replacement while
   approval is pending. Follow any `requires_action` instructions.
6. After the request is `approved`, inspect the checkout fields again. Call
   `link__secure_checkout` with the exact field, submit, and success selectors. This tool asks for
   Eve approval and retrieves the one-time card inside the server process. Never ask for, print,
   or copy the card number, CVC, expiry, or payment token.
7. A submitted form is not proof of payment. Verify the visible success state before you claim
   success. If success is not verified, inspect the page before any retry. Never submit twice only
   because the result is unclear.
8. Call `link__create_report` with the real spend-request ID and a redacted outcome. Do not put the
   buyer's name, address, email, phone, order number, or payment credential in a report.

`LINK_ACCESS_TOKEN` is server configuration. Never ask the user to paste it into chat.
