import { defineFn } from "@browserbasehq/sdk-functions";
import { workflowParams } from "../shared/params";
import { openPlatformASession } from "../shared/session";
import { EXTRACT_SERVICES } from "../shared/extract";
import { servicesCsv } from "../shared/schema";
import { deliverCsv } from "../shared/deliver";
import { ok, fail } from "../shared/result";

/**
 * platform-a-services-list — DETERMINISTIC (no LLM). Replays Platform A's catalog API on an authenticated page and
 * writes the clean services schema CSV into the session downloads. No Stagehand agent, no custom tools, so
 * nothing forces experimental mode.
 */
const START_URL = "https://platform-a.example.invalid/dashboard/items/services";

defineFn(
  "platform-a-services-list",
  async (ctx) => {
    const stage: string[] = [];
    let s: Awaited<ReturnType<typeof openPlatformASession>> | undefined;
    try {
      stage.push("opening session");
      s = await openPlatformASession(ctx, { startUrl: START_URL });
      stage.push(`session ${s.sessionId} open, evaluating`);
      const rows = (await s.page.evaluate(EXTRACT_SERVICES)) as any[];
      stage.push(`extracted ${rows.length} rows`);
      const csv = servicesCsv(rows);
      stage.push("built csv, delivering");
      // Size-agnostic delivery: write the schema CSV into the session downloads (synced to Browserbase
      // storage now that setDownloadBehavior is configured). Caller fetches it via the Downloads API.
      const zipBytes = await deliverCsv(
        s.page,
        s.bb,
        s.sessionId,
        "services.csv",
        csv,
      );
      stage.push("delivered");
      return ok({
        sessionId: s.sessionId,
        filename: "services.csv",
        rows: rows.length,
        bytes: csv.length,
        zipBytes,
        downloadHint:
          "Fetch via the Browserbase Downloads API with your apiKey + this sessionId (services.csv inside the zip).",
      });
    } catch (err) {
      // Surface the real error in the result (invocation logs aren't accessible via CLI).
      return fail(err, {
        lastStage: stage[stage.length - 1] ?? "(none)",
        stages: stage.join(" → "),
      });
    } finally {
      if (s) await s.close();
    }
  },
  { parametersSchema: workflowParams },
);
