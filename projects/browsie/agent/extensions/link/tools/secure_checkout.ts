import { defineTool, toolOutput } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { retrieveApprovedLinkCard } from "../../../../server/link-wallet.js";
import {
  runBrowserOperation,
  runCancelableBrowserWork,
} from "../../../lib/browser-runtime.js";

const target = z.string().min(1).max(500);
const inputSchema = z
  .strictObject({
    spendRequestId: z.string().min(1),
    cardNumberTarget: target,
    cvcTarget: target,
    expiryMode: z
      .enum(["combined", "split"])
      .default("combined")
      .describe(
        "Use combined for one expiry field or split for separate month and year fields. Only targets for the selected mode are used.",
      ),
    expiryTarget: target.optional(),
    expiryMonthTarget: target.optional(),
    expiryYearTarget: target.optional(),
    expiryFormat: z.enum(["MM/YY", "MMYY", "MM/YYYY"]).default("MM/YY"),
    cardholderNameTarget: target.optional(),
    postalCodeTarget: target.optional(),
    submitTarget: target,
    successTarget: target,
  })
  .superRefine((input, ctx) => {
    if (input.expiryMode === "combined" && !input.expiryTarget) {
      ctx.addIssue({
        code: "custom",
        message: "Provide expiryTarget when expiryMode is combined.",
      });
    }
    if (
      input.expiryMode === "split" &&
      (!input.expiryMonthTarget || !input.expiryYearTarget)
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Provide both expiryMonthTarget and expiryYearTarget when expiryMode is split.",
      });
    }
  });

export default defineTool({
  description:
    "After the user approved a Link card spend request, securely retrieve its one-time card and submit the current merchant checkout. Card data stays inside the server and browser boundary. Inspect the checkout first and pass exact field and success selectors. This tool always asks for Eve approval and also requires prior Link approval.",
  inputSchema,
  approval: always(),
  async execute(input, ctx) {
    const credential = await retrieveApprovedLinkCard(input.spendRequestId);
    const output = await runCancelableBrowserWork(ctx.session.id, ctx.abortSignal, () =>
      runBrowserOperation(ctx.session.id, (browser) =>
        browser.secureLinkCheckout({
          merchantUrl: credential.merchantUrl,
          card: credential.card,
          cardNumberTarget: input.cardNumberTarget,
          cvcTarget: input.cvcTarget,
          expiryTarget: input.expiryMode === "combined" ? input.expiryTarget : undefined,
          expiryMonthTarget:
            input.expiryMode === "split" ? input.expiryMonthTarget : undefined,
          expiryYearTarget:
            input.expiryMode === "split" ? input.expiryYearTarget : undefined,
          expiryFormat: input.expiryFormat,
          cardholderNameTarget: input.cardholderNameTarget,
          postalCodeTarget: input.postalCodeTarget,
          submitTarget: input.submitTarget,
          successTarget: input.successTarget,
        }),
      ),
    );
    return {
      ...output,
      result: {
        ...output.result,
        spendRequestId: credential.spendRequestId,
        merchantName: credential.merchantName,
      },
    };
  },
  toModelOutput(output) {
    return toolOutput.json(output.result);
  },
});
