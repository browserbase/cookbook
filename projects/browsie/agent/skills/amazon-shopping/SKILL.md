---
name: amazon-shopping
description: Use for Amazon sign-in, cart, and checkout-review tasks. Supports secure staged login and always stops before placing an order.
---

# Amazon shopping

1. Work only on the Amazon country site requested by the user.
2. To sign in with a vault item, open the Amazon sign-in page and call `vault_login` with the
   visible selectors. Amazon normally uses a staged form. On amazon.com, the usual selectors are
   `#ap_email`, `#continue`, `#ap_password`, and `#signInSubmit`. Verify the current page before you
   use them.
3. Pass `usernameSubmitTarget` for the Continue button. Do not use `run` to copy, read, or fill a
   secret.
4. If Amazon requests an OTP, passkey, login approval, or another human step that the vault cannot
   complete, call `human_handoff`. Keep the same browser open and continue after the user replies
   `done`.
5. If the user asks to save the login, call `context_save` only after the signed-in state is
   visible and verified.
6. You may add the requested item to the cart and continue to the final order-review page when the
   user asks. Verify the product, variant, quantity, seller, shipping address, delivery date, and
   total.
7. Never click `Place your order`, `Buy now`, or another final purchase control. Stop on the final
   review page and ask the user to review it.
