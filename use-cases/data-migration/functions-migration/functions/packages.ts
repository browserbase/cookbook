import { defineFn } from "@browserbasehq/sdk-functions";
import { workflowParams } from "../shared/params";
import { openPlatformASession } from "../shared/session";
import { EXTRACT_PACKAGES } from "../shared/extract";
import { packagesCsv } from "../shared/schema";
import { deliverCsv } from "../shared/deliver";
import { ok, fail } from "../shared/result";

/** platform-a-packages — DETERMINISTIC. Credit packages via catalog search, bundle (service + credits) resolved. */
const START_URL = "https://platform-a.example.invalid/dashboard/items/library";

defineFn(
  "platform-a-packages",
  async (ctx) => {
    let s: Awaited<ReturnType<typeof openPlatformASession>> | undefined;
    try {
      s = await openPlatformASession(ctx, { startUrl: START_URL });
      const res = (await s.page.evaluate(EXTRACT_PACKAGES)) as {
        rows?: any[];
        error?: string;
      };
      if (res.error || !res.rows)
        return fail(res.error || "no rows returned", {
          sessionId: s.sessionId,
        });
      const csv = packagesCsv(res.rows);
      const zipBytes = await deliverCsv(
        s.page,
        s.bb,
        s.sessionId,
        "packages.csv",
        csv,
      );
      return ok({
        sessionId: s.sessionId,
        filename: "packages.csv",
        packages: res.rows.length,
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
