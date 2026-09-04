import { runSessionTask } from "../shared/agent";
import { defineFn } from "@browserbasehq/sdk-functions";
import { workflowParams } from "../shared/params";
import {
  BROWSERBASE_API_KEY,
  SQUARE_CUSTOMER_NOTES_CONTEXT_ID,
} from "../shared/config";
import { openSquareSession } from "../shared/session";
import {
  waitForDownloadZip,
  readZipEntry,
  deliverCsv,
} from "../shared/deliver";
import { clientNotesCsv } from "../shared/schema";

const SQUARE_CONTEXT_ID = SQUARE_CUSTOMER_NOTES_CONTEXT_ID;

const INSTRUCTION = `Navigate to this Square customer directory page (already authenticated):
https://app.squareup.com/dashboard/customers/directory

Export all customer notes as a CSV:

1. If a cookie-consent banner appears, click "Accept all cookies" to dismiss it.
2. Click the "Import / Export" button in the top-right, select "Export notes", keep "All customers", and confirm by clicking "Export". Square processes the export asynchronously. Then close that dialog.
3. The export takes time to process. You MUST poll for it: wait ~12 seconds, then re-open the "Import / Export" dialog and look for a message that a CSV file is ready with a "Download" button. If it is NOT ready yet, close the dialog, wait ~12 seconds, and re-open it again. Repeat this poll up to 8 times until the Download button appears.
4. When the "Download" button appears, click it to start the browser download.
5. After clicking Download, wait ~5 seconds to let the download finish, then you are done. The file is retrieved via the Browserbase Session Downloads API externally — do not attempt to capture the URL or save the file yourself. Do NOT finish the task until you have actually clicked the Download button.`;

defineFn(
  "square-customer-notes",
  async (ctx) => {
    const agentResult = await runSessionTask(ctx.session.id, INSTRUCTION);

    let rows = 0;
    let mapped = false;
    let mapError: string | null = null;
    let s: Awaited<ReturnType<typeof openSquareSession>> | undefined;
    try {
      s = await openSquareSession(ctx);
      const zip = await waitForDownloadZip(s.bb, s.sessionId, {
        timeoutMs: 60_000,
      });
      const square = readZipEntry(zip, ".csv"); // Square's export-*.csv
      const out = clientNotesCsv(square.text);
      rows = out.rows;
      await deliverCsv(s.page, s.bb, s.sessionId, "client-notes.csv", out.csv);
      mapped = true;
    } catch (e: any) {
      mapError = String(e?.message ?? e).slice(0, 180);
    } finally {
      if (s) await s.close();
    }

    return {
      ok: agentResult.success && mapped,
      sessionId: ctx.session.id,
      filename: "client-notes.csv",
      rows,
      mapped,
      mapError,
      downloadHint:
        "client-notes.csv (clean schema: Client name, Client email, Client phone number, Note creation date, Note author, Client note) is in the session downloads alongside Square's raw export-*.csv — fetch via the Browserbase Downloads API with the sessionId. Email/phone are joined downstream by Customer ID from square-customer-list.",
      agentResult,
    };
  },
  {
    parametersSchema: workflowParams,
    // keepAlive + a generous timeout so the session survives the async export processing + download click
    // (the default-timeout session was reaped mid-run).
    sessionConfig: {
      proxies: false,
      keepAlive: true,
      api_timeout: 900,
      browserSettings: {
        viewport: { width: 1288, height: 711 },
        context: { id: SQUARE_CONTEXT_ID, persist: false },
      },
    },
  },
);
