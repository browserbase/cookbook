import { describe, expect, it } from "vitest";

import { BrowsieBrowserSession } from "../server/browser-session.js";
import type { ConversationState } from "../server/types.js";
import { onePasswordVault } from "../server/vault/index.js";

const live =
  process.env.BROWSIE_LIVE_ONEPASSWORD === "1" &&
  Boolean(process.env.BROWSERBASE_API_KEY) &&
  Boolean(process.env.OP_SERVICE_ACCOUNT_TOKEN);

describe("opt-in live 1Password login", () => {
  it.runIf(live)(
    "uses a Login item without exposing credentials to the model",
    async () => {
      const items = await onePasswordVault.list(),
        item = items.find((candidate) => candidate.allowedHosts.includes("authenticationtest.com"));
      expect(item).toBeDefined();
      expect(item?.fields).toEqual({
        username: true,
        password: true,
        totp: true,
      });
      if (!item?.vaultId) throw new Error("The test Login item is missing.");
      const ref = (field: "username" | "password" | "totp") => ({
          provider: "onepassword" as const,
          vaultId: item.vaultId,
          itemId: item.itemId,
          field,
        }),
        username = await onePasswordVault.resolve(ref("username")),
        password = await onePasswordVault.resolve(ref("password")),
        totp = await onePasswordVault.resolve(ref("totp")),
        state: ConversationState = {
          id: "live-onepassword-login",
          traces: [],
          browser: { provider: "not-started", status: "idle" },
        },
        session = new BrowsieBrowserSession(state);
      try {
        await session.run({
          code: 'await page.goto("https://authenticationtest.com/totpChallenge/");',
        });
        const result = await session.secureLogin({
          allowedHosts: item.allowedHosts,
          username,
          password,
          totp,
          usernameTarget: "#email",
          passwordTarget: "#password",
          totpTarget: "#totpmfa",
          submitTarget: 'input[type="submit"]',
          successTarget: "div.alert.alert-success",
        });
        const page = await session.snapshot();
        expect(result.status).toBe("complete");
        expect(new URL(result.url).pathname).toBe("/loginSuccess/");
        expect(page.tree).toContain("Login Success");
        expect(page.tree).toContain("You are now logged in");
        console.log(
          JSON.stringify(
            {
              status: "pass",
              host: result.host,
              finalPath: new URL(result.url).pathname,
              pagePreview: page.tree.slice(0, 500),
              secretValuesPrinted: false,
            },
            null,
            2,
          ),
        );
      } finally {
        await session.close();
      }
    },
    120_000,
  );
});
