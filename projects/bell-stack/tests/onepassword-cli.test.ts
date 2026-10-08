import { describe, expect, it } from "vitest";

import { toSafeCliItem } from "../server/vault/onepassword.js";

describe("1Password CLI fallback", () => {
  it("returns safe Login metadata without secret values", () => {
    const item = toSafeCliItem(
      { id: "vault-1", name: "Browserbase Agent Vault" },
      {
        id: "item-1",
        title: "Authentication Test",
        category: "LOGIN",
        urls: [{ href: "https://authenticationtest.com/totpChallenge/" }],
        fields: [
          { id: "username", purpose: "USERNAME", value: "private-user" },
          { id: "password", purpose: "PASSWORD", value: "private-password" },
          { id: "otp", type: "OTP", value: "private-totp-seed" },
        ],
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-18T00:00:00Z",
      },
    );

    expect(item).toEqual({
      provider: "onepassword",
      vaultId: "vault-1",
      vaultName: "Browserbase Agent Vault",
      itemId: "item-1",
      label: "Authentication Test",
      allowedHosts: ["authenticationtest.com"],
      fields: { username: true, password: true, totp: true },
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-18T00:00:00Z",
    });
    expect(JSON.stringify(item)).not.toContain("private-user");
    expect(JSON.stringify(item)).not.toContain("private-password");
    expect(JSON.stringify(item)).not.toContain("private-totp-seed");
  });
});
