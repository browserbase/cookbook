import { defineTool, toolOutput } from "eve/tools";
import { z } from "zod";

import { nativeVault, onePasswordVault } from "../../server/vault/index.js";
import { generateTotp } from "../../server/vault/totp.js";
import type { SecretRef } from "../../server/vault/types.js";
import { runBrowserOperation, runCancelableBrowserWork } from "../lib/browser-runtime";
import { taskState } from "../lib/task-state";

const selector = z.string().min(1).max(500);
export default defineTool({
  description:
    "Fill and submit a mapped Login without exposing credentials to the model. Navigate and snapshot first. Pass the opaque item handle plus exact selectors. A successTarget is required to prove login. If an OTP field exists but the item has no TOTP secret, this returns waiting_for_user; immediately call ask_question so the Eve task parks durably.",
  inputSchema: z.object({
    provider: z.enum(["native", "onepassword"]),
    itemId: z.string().min(1),
    vaultId: z.string().optional(),
    usernameTarget: selector,
    passwordTarget: selector,
    submitTarget: selector,
    successTarget: selector,
    totpTarget: selector.optional(),
    otpSubmitTarget: selector.optional(),
    totpFlow: z.enum(["same_form", "after_submit"]).default("same_form"),
  }),
  async execute(input, ctx) {
    const provider = input.provider === "native" ? nativeVault : onePasswordVault;
    const items = await provider.list(),
      item = items.find(
        (candidate) =>
          candidate.itemId === input.itemId &&
          (input.provider === "native" || candidate.vaultId === input.vaultId),
      );
    if (!item) throw new Error("Vault login handle not found.");
    const ref = (field: SecretRef["field"]): SecretRef => ({
      provider: input.provider,
      itemId: input.itemId,
      vaultId: input.vaultId,
      field,
    });
    const username = await provider.resolve(ref("username")),
      password = await provider.resolve(ref("password"));
    let totp: string | undefined;
    if (input.totpTarget && (item.fields.totp || input.provider === "onepassword")) {
      try {
        const value = await provider.resolve(ref("totp"));
        totp = input.provider === "onepassword" ? value : generateTotp(value);
      } catch {
        totp = undefined;
      }
    }
    const output = await runCancelableBrowserWork(ctx.session.id, ctx.abortSignal, () =>
      runBrowserOperation(ctx.session.id, (browser) =>
        browser.secureLogin({
          allowedHosts: item.allowedHosts,
          username,
          password,
          usernameTarget: input.usernameTarget,
          passwordTarget: input.passwordTarget,
          submitTarget: input.submitTarget,
          successTarget: input.successTarget,
          totpTarget: input.totpTarget,
          otpSubmitTarget: input.otpSubmitTarget,
          totp,
          totpAfterSubmit: input.totpFlow === "after_submit",
        }),
      ),
    );
    if (output.result.status === "waiting_for_user")
      taskState.update((current) => ({
        ...current,
        status: "waiting_for_user",
        activeStep: "waiting for OTP or human challenge",
        waitReason: "otp",
        updatedAt: new Date().toISOString(),
      }));
    return output;
  },
  toModelOutput(output) {
    return toolOutput.json(output.result);
  },
});
