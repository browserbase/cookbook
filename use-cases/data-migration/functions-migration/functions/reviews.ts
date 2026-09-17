import { defineFn } from "@browserbasehq/sdk-functions";
import { workflowParams } from "../shared/params";
import { openPlatformASession } from "../shared/session";
import { EXTRACT_REVIEWS } from "../shared/extract";
import { reviewsCsv } from "../shared/schema";
import { deliverCsv } from "../shared/deliver";
import { ok, fail } from "../shared/result";

/**
 * platform-a-reviews — DETERMINISTIC. All customer feedback (all time, with + without comments), enriched with
 * the service name(s) per feedback via the transaction-families join. Runs on the transactions page (the
 * account merchant_token needed for the join is exposed there). `rating` = Platform A's sentiment; `client_email`
 * is left blank (the per-customer email lives in the clients export, not fetched here).
 */
const START_URL = "https://platform-a.example.invalid/dashboard/sales/transactions";

defineFn(
  "platform-a-reviews",
  async (ctx) => {
    let s: Awaited<ReturnType<typeof openPlatformASession>> | undefined;
    try {
      s = await openPlatformASession(ctx, { startUrl: START_URL });
      const res = (await s.page.evaluate(EXTRACT_REVIEWS)) as {
        rows?: any[];
        error?: string;
      };
      if (res.error || !res.rows)
        return fail(res.error || "no rows returned", {
          sessionId: s.sessionId,
        });
      const csv = reviewsCsv(res.rows);
      const zipBytes = await deliverCsv(
        s.page,
        s.bb,
        s.sessionId,
        "reviews.csv",
        csv,
      );
      return ok({
        sessionId: s.sessionId,
        filename: "reviews.csv",
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
