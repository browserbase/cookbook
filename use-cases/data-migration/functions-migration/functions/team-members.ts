import { defineFn } from "@browserbasehq/sdk-functions";
import { workflowParams } from "../shared/params";
import { openPlatformASession } from "../shared/session";
import { EXTRACT_TEAM_MEMBERS } from "../shared/extract";
import { teamMembersCsv } from "../shared/schema";
import { deliverCsv } from "../shared/deliver";
import { ok, fail } from "../shared/result";

/**
 * platform-a-team-members — DETERMINISTIC (no LLM). The demo repo did this with a custom Stagehand tool; here
 * the same 3-way join (staff × services × business_locations) runs as a plain page.evaluate so we never
 * register a custom tool (which would force experimental mode and bypass the model gateway). Writes the
 * clean team-members schema CSV into the session downloads.
 */
const START_URL = "https://platform-a.example.invalid/dashboard/appointments";

defineFn(
  "platform-a-team-members",
  async (ctx) => {
    let s: Awaited<ReturnType<typeof openPlatformASession>> | undefined;
    try {
      s = await openPlatformASession(ctx, { startUrl: START_URL });
      const res = (await s.page.evaluate(EXTRACT_TEAM_MEMBERS)) as {
        rows?: any[];
        error?: string;
      };
      if (res.error || !res.rows)
        return fail(res.error || "no rows returned", {
          sessionId: s.sessionId,
        });
      const csv = teamMembersCsv(res.rows);
      const zipBytes = await deliverCsv(
        s.page,
        s.bb,
        s.sessionId,
        "team-members.csv",
        csv,
      );
      return ok({
        sessionId: s.sessionId,
        filename: "team-members.csv",
        rows: res.rows.length,
        bytes: csv.length,
        zipBytes,
        downloadHint:
          "Fetch via the Browserbase Downloads API with your apiKey + this sessionId (team-members.csv inside the zip).",
      });
    } catch (err) {
      return fail(err);
    } finally {
      if (s) await s.close();
    }
  },
  { parametersSchema: workflowParams },
);
