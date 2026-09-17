import { defineFn } from "@browserbasehq/sdk-functions";
import { workflowParams } from "../shared/params";
import { openPlatformASession } from "../shared/session";
import { EXTRACT_CLIENT_PACKAGES } from "../shared/extract";
import { clientPackagesCsv } from "../shared/schema";
import { deliverCsv } from "../shared/deliver";
import { ok, fail } from "../shared/result";

/**
 * platform-a-client-packages — DETERMINISTIC. Per-customer purchased package credits via two protobuf RPCs
 * (enumerate customers, then per-customer SearchCreditPacks) joined to the catalog. Runs on the transactions
 * page where the account merchant_token is exposed. Can take a while on large customer bases.
 */
const START_URL = "https://platform-a.example.invalid/dashboard/sales/transactions";

defineFn(
  "platform-a-client-packages",
  async (ctx) => {
    let s: Awaited<ReturnType<typeof openPlatformASession>> | undefined;
    try {
      s = await openPlatformASession(ctx, { startUrl: START_URL });
      await new Promise((r) => setTimeout(r, 10_000)); // let the SPA render so the merchant token is populated before the extract

      const res = (await s.page.evaluate(EXTRACT_CLIENT_PACKAGES)) as {
        rows?: any[];
        error?: string;
        complete?: boolean;
        customersProbed?: number;
      };
      if (!res || res.error || res.complete !== true || !Array.isArray(res.rows) || !Number.isSafeInteger(res.customersProbed) || (res.customersProbed ?? -1) < 0)
        return fail("package extraction did not complete", {
          sessionId: s.sessionId,
        });
      const csv = clientPackagesCsv(res.rows);
      const zipBytes = await deliverCsv(
        s.page,
        s.bb,
        s.sessionId,
        "client-packages.csv",
        csv,
      );
      return ok({
        sessionId: s.sessionId,
        filename: "client-packages.csv",
        rows: res.rows.length,
        bytes: csv.length,
        zipBytes,
      });
    } catch (err) {
      return fail("Client package export failed before delivery completed");
    } finally {
      if (s) await s.close();
    }
  },
  { parametersSchema: workflowParams },
);
