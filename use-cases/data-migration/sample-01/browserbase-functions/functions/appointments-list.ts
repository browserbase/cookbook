import { defineFn } from "@browserbasehq/sdk-functions";
import { workflowParams } from "../shared/params";
import { openSquareSession } from "../shared/session";
import { EXTRACT_APPOINTMENTS } from "../shared/extract";
import { appointmentsCsv } from "../shared/schema";
import { deliverCsv } from "../shared/deliver";
import { ok, fail } from "../shared/result";

/**
 * square-appointments-list — DETERMINISTIC. Reservations across EVERY location × ALL staff (6 months back →
 * 6 months forward), deduped by id. Service names resolve via the catalog, staff via employee_attributions,
 * location via business_locations, price via the cart total. Recurring appointments keep their rrule (one
 * row at the series start). Client email/phone aren't on the reservation, so they're blank.
 */
const START_URL = "https://app.squareup.com/dashboard/appointments/calendar";

defineFn(
  "square-appointments-list",
  async (ctx) => {
    let s: Awaited<ReturnType<typeof openSquareSession>> | undefined;
    try {
      s = await openSquareSession(ctx, { startUrl: START_URL });
      const res = (await s.page.evaluate(EXTRACT_APPOINTMENTS)) as {
        rows?: any[];
        error?: string;
      };
      if (res.error || !res.rows)
        return fail(res.error || "no rows returned", {
          sessionId: s.sessionId,
        });
      const csv = appointmentsCsv(res.rows);
      const zipBytes = await deliverCsv(
        s.page,
        s.bb,
        s.sessionId,
        "appointments.csv",
        csv,
      );
      return ok({
        sessionId: s.sessionId,
        filename: "appointments.csv",
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
