import type { SpendRequest } from "@stripe/link-sdk";
import { describe, expect, it } from "vitest";

import {
  allowedLinkCheckoutHosts,
  approvedLinkCard,
  formatLinkExpiry,
} from "../server/link-wallet.js";

function request(overrides: Partial<SpendRequest> = {}): SpendRequest {
  return {
    id: "lsrq_test",
    status: "approved",
    credential_type: "card",
    merchant_name: "Example Shop",
    merchant_url: "https://shop.example/checkout",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    card: {
      id: "card_test",
      brand: "visa",
      number: "test-card-number",
      cvc: "test-cvc",
      exp_month: 7,
      exp_year: 2099,
      valid_until: "2099-07-31T23:59:59.000Z",
      billing_address: {
        name: "Test Buyer",
        line1: "1 Test Way",
        city: "Test City",
        state: "CA",
        postal_code: "94107",
        country: "US",
      },
    },
    ...overrides,
  };
}

describe("Stripe Link wallet boundary", () => {
  it("accepts only an approved card request", () => {
    const approved = approvedLinkCard(request(), "lsrq_test");
    expect(approved.spendRequestId).toBe("lsrq_test");
    expect(approved.merchantUrl).toBe("https://shop.example/checkout");

    expect(() => approvedLinkCard(request({ status: "pending_approval" }), "lsrq_test")).toThrow(
      "not approved",
    );
    expect(() => approvedLinkCard(request(), "another_request")).toThrow("not found");
  });

  it("binds secure checkout to the exact merchant host", () => {
    expect(allowedLinkCheckoutHosts("https://shop.example/checkout")).toEqual(["shop.example"]);
    expect(allowedLinkCheckoutHosts("https://checkout.stripe.com/c/pay/test")).toEqual([
      "checkout.stripe.com",
    ]);
    expect(() => allowedLinkCheckoutHosts("file:///tmp/checkout")).toThrow("invalid merchant URL");
  });

  it("formats common card expiry fields", () => {
    expect(formatLinkExpiry(7, 2031, "MM/YY")).toBe("07/31");
    expect(formatLinkExpiry(7, 2031, "MMYY")).toBe("0731");
    expect(formatLinkExpiry(7, 2031, "MM/YYYY")).toBe("07/2031");
  });
});
