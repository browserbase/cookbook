import assert from "node:assert/strict";
import test from "node:test";
import { assertEmployerDashboard } from "./outcome.js";
import { extractConfirmationLink } from "./agentmail.js";

function page(title: string, url: string, content: string) {
  return {
    title: async () => title,
    url: () => url,
    content: async () => content,
  };
}

test("rejects an OTP error page", async () => {
  await assert.rejects(
    assertEmployerDashboard(
      page("Verification code rejected", "https://synthetic.invalid/otp-error", "Try again") as never,
    ),
    /did not reach/,
  );
});

test("accepts an authenticated employer dashboard signal", async () => {
  await assertEmployerDashboard(
    page(
      "Employer Services Online",
      "https://edd.ca.gov/dashboard",
      "Employer Services Online My Accounts Payroll Tax",
    ) as never,
  );
});

test("standalone link extractor enforces the URL authority", () => {
  assert.equal(
    extractConfirmationLink(
      {
        messageId: "unsafe",
        extractedText: "https://edd.ca.gov@evil.example/activate",
      },
      { allowedHosts: ["edd.ca.gov"] },
    ),
    null,
  );
  assert.equal(
    extractConfirmationLink(
      {
        messageId: "safe",
        extractedText: "https://edd.ca.gov/activate?token=synthetic",
      },
      { allowedHosts: ["edd.ca.gov"] },
    ),
    "https://edd.ca.gov/activate?token=synthetic",
  );
});
