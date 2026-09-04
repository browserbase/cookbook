import { defineFn } from "@browserbasehq/sdk-functions";
import { workflowParams } from "../shared/params";
import { openSquareSession } from "../shared/session";
import { EXTRACT_UNAVAILABILITIES } from "../shared/extract";
import { unavailabilitiesCsv } from "../shared/schema";
import { deliverCsv } from "../shared/deliver";
import { ok, fail } from "../shared/result";

/** square-unavailabilities — DETERMINISTIC. Calendar events (lunch/time-off/busy blocks) for a 12-month window. */
const START_URL = "https://app.squareup.com/dashboard/appointments/calendar";

defineFn(
  "square-unavailabilities",
  async (ctx) => {
    let s: Awaited<ReturnType<typeof openSquareSession>> | undefined;
    try {
      s = await openSquareSession(ctx, { startUrl: START_URL });
      const res = (await s.page.evaluate(EXTRACT_UNAVAILABILITIES)) as {
        rows?: any[];
        error?: string;
      };
      if (res.error || !res.rows)
        return fail(res.error || "no rows returned", {
          sessionId: s.sessionId,
        });
      const csv = unavailabilitiesCsv(res.rows);
      const zipBytes = await deliverCsv(
        s.page,
        s.bb,
        s.sessionId,
        "unavailabilities.csv",
        csv,
      );
      return ok({
        sessionId: s.sessionId,
        filename: "unavailabilities.csv",
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
