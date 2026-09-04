import { defineFn } from "@browserbasehq/sdk-functions";
import { workflowParams } from "../shared/params";
import { openSquareSession } from "../shared/session";
import { EXTRACT_CUSTOMERS } from "../shared/extract";
import { customersCsv } from "../shared/schema";
import { deliverCsv } from "../shared/deliver";
import { ok, fail } from "../shared/result";

/**
 * square-customer-list — DETERMINISTIC (no LLM, no agent). Enumerates ALL customers via the
 * SearchAndGetCustomers protobuf RPC and maps name/email/phone to the clients schema. Replaces the old
 * tool-less agent (which needed the model gateway). Marketing consent isn't reliably identifiable in the
 * protobuf flags, so it's left blank — a documented gap.
 */
const START_URL = "https://app.squareup.com/dashboard/customers/directory";

defineFn(
  "square-customer-list",
  async (ctx) => {
    let s: Awaited<ReturnType<typeof openSquareSession>> | undefined;
    try {
      s = await openSquareSession(ctx, { startUrl: START_URL });
      const res = (await s.page.evaluate(EXTRACT_CUSTOMERS)) as {
        rows?: any[];
        error?: string;
      };
      if (res.error || !res.rows)
        return fail(res.error || "no rows returned", {
          sessionId: s.sessionId,
        });
      const csv = customersCsv(res.rows);
      const zipBytes = await deliverCsv(
        s.page,
        s.bb,
        s.sessionId,
        "clients.csv",
        csv,
      );
      return ok({
        sessionId: s.sessionId,
        filename: "clients.csv",
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
