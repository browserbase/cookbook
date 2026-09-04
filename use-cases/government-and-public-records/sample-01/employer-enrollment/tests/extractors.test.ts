import { describe, it, expect } from "vitest";
import {
  extractConfirmationLink,
  extractOtpCode,
} from "../src/inbox/extractors.js";
import type { InboxMessage } from "../src/inbox/agentmail.js";

const magicLinkMsg: InboxMessage = {
  messageId: "m1",
  subject: "Sign in to Substack",
  extractedHtml: `
    <p>Click below to sign in:</p>
    <a href="https://substack.com/sign-in?token=abc123xyz&amp;next=%2Fhome">Sign in</a>
    <p>Or <a href="https://substack.com/unsubscribe?id=42">unsubscribe</a>.</p>
  `,
  extractedText:
    "Click below to sign in: https://substack.com/sign-in?token=abc123xyz",
};

const otpMsg: InboxMessage = {
  messageId: "m2",
  subject: "Your verification code",
  extractedHtml:
    "<p>Reference #102938 — please ignore.</p><p>Your verification code is 482915.</p>",
  extractedText:
    "Reference #102938 — please ignore. Your verification code is 482915.",
};

const unsubscribeOnlyMsg: InboxMessage = {
  messageId: "m3",
  subject: "Welcome",
  extractedHtml: `<a href="https://example.com/unsubscribe?id=1">Unsubscribe</a>`,
  extractedText: "Unsubscribe: https://example.com/unsubscribe?id=1",
};

describe("extractConfirmationLink", () => {
  it("finds the magic link and skips unsubscribe", () => {
    const link = extractConfirmationLink(magicLinkMsg, {
      hostMatch: /substack\.com/,
    });
    expect(link).toBe(
      "https://substack.com/sign-in?token=abc123xyz&next=%2Fhome",
    );
  });

  it("returns null when only unsubscribe links exist", () => {
    expect(extractConfirmationLink(unsubscribeOnlyMsg)).toBeNull();
  });

  it("respects hostMatch filter", () => {
    const link = extractConfirmationLink(magicLinkMsg, {
      hostMatch: /nope\.example\.com/,
    });
    expect(link).toBeNull();
  });

  it("requires HTTPS and an exact allowed hostname", () => {
    const unsafeLinks = [
      "https://evil.example/edd.ca.gov/activate",
      "https://edd.ca.gov@evil.example/activate",
      "https://edd.ca.gov.evil.example/activate",
      "http://edd.ca.gov/activate",
    ];
    for (const link of unsafeLinks) {
      expect(
        extractConfirmationLink(
          { messageId: link, extractedText: link },
          { allowedHosts: ["edd.ca.gov"] },
        ),
      ).toBeNull();
    }
    expect(
      extractConfirmationLink(
        {
          messageId: "safe",
          extractedText: "https://edd.ca.gov/activate?token=synthetic",
        },
        { allowedHosts: ["edd.ca.gov"] },
      ),
    ).toBe("https://edd.ca.gov/activate?token=synthetic");
    expect(
      extractConfirmationLink(
        {
          messageId: "safe-subdomain",
          extractedText: "https://services.edd.ca.gov/activate?token=synthetic",
        },
        { allowedHosts: ["edd.ca.gov"] },
      ),
    ).toBe("https://services.edd.ca.gov/activate?token=synthetic");
  });

  it("falls back to plain text when no HTML is present", () => {
    const textOnly: InboxMessage = {
      messageId: "m4",
      subject: "Verify",
      extractedText: "Visit https://substack.com/sign-in?token=xyz to verify.",
    };
    expect(
      extractConfirmationLink(textOnly, { hostMatch: /substack\.com/ }),
    ).toBe("https://substack.com/sign-in?token=xyz");
  });
});

describe("extractOtpCode", () => {
  it("finds the 6-digit code near the keyword", () => {
    expect(extractOtpCode(otpMsg)).toBe("482915");
  });

  it("returns null when no code is present", () => {
    expect(extractOtpCode(unsubscribeOnlyMsg)).toBeNull();
  });

  it("honors custom length", () => {
    const msg: InboxMessage = {
      messageId: "m5",
      subject: "Code",
      extractedText: "Your code is 1234.",
    };
    expect(extractOtpCode(msg, { length: 4 })).toBe("1234");
  });

  it("honors custom pattern with capture group", () => {
    const msg: InboxMessage = {
      messageId: "m6",
      subject: "Code",
      extractedText: "Code: A7B-3K9",
    };
    expect(extractOtpCode(msg, { pattern: /Code:\s+([A-Z0-9-]+)/ })).toBe(
      "A7B-3K9",
    );
  });

  it("falls back to first match when no keyword nearby", () => {
    const msg: InboxMessage = {
      messageId: "m7",
      subject: "Numbers",
      extractedText: "Random numbers 123456 and 987654.",
    };
    // No OTP keyword anywhere → both candidates have infinity distance; sort is stable so first wins.
    expect(extractOtpCode(msg)).toBe("123456");
  });
});
