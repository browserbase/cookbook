import { defineFn } from "@browserbasehq/sdk-functions";
import { workflowParams } from "../shared/params";
import { openPlatformASession } from "../shared/session";
import { EXTRACT_PRODUCTS } from "../shared/extract";
import { productsCsv } from "../shared/schema";
import { deliverCsv } from "../shared/deliver";
import { ok, fail } from "../shared/result";

/**
 * platform-a-products — DETERMINISTIC (no LLM, no agent). Retail items from the catalog API (product_type
 * REGULAR), one row per variation. Replaces the old UI-export agent. Stock count / low-quantity-level need
 * Platform A's inventory API (not in the catalog) and are left blank for now — a documented gap.
 */
const START_URL = "https://platform-a.example.invalid/dashboard/items/library";

defineFn(
  "platform-a-products",
  async (ctx) => {
    let s: Awaited<ReturnType<typeof openPlatformASession>> | undefined;
    try {
      s = await openPlatformASession(ctx, { startUrl: START_URL });
      const res = (await s.page.evaluate(EXTRACT_PRODUCTS)) as {
        rows?: any[];
        complete?: boolean;
        error?: string;
      };
      if (res.error || res.complete !== true || !Array.isArray(res.rows))
        return fail(res.error || "product extraction incomplete or invalid", {
          sessionId: s.sessionId,
        });
      const csv = productsCsv(res.rows);
      const zipBytes = await deliverCsv(
        s.page,
        s.bb,
        s.sessionId,
        "retail-items.csv",
        csv,
      );
      return ok({
        sessionId: s.sessionId,
        filename: "retail-items.csv",
        rows: res.rows.length,
        bytes: csv.length,
        zipBytes,
      });
    } catch (err) {
      return fail(err);
    } finally {
      if (s) await s.close();
    }
  },
  { parametersSchema: workflowParams },
);
