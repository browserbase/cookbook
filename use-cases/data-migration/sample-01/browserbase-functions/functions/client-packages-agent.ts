import { defineFn } from "@browserbasehq/sdk-functions";
import Browserbase from "@browserbasehq/sdk";
import { workflowParams } from "../shared/params";
import {
  BROWSERBASE_API_KEY,
  SQUARE_CLIENT_PACKAGES_CONTEXT_ID,
} from "../shared/config";
import { runSessionTask } from "../shared/agent";
import { openSquareSession } from "../shared/session";
import {
  waitForDownloadZip,
  readZipEntry,
  deliverCsv,
} from "../shared/deliver";
import { parseCsvObjects, clientPackagesCsv } from "../shared/schema";
import { buildExtractPacksForTokens } from "../shared/extract";

const SQUARE_CONTEXT_ID = SQUARE_CLIENT_PACKAGES_CONTEXT_ID;

const INSTRUCTION = `Navigate to this Square customer directory page (already authenticated):
https://app.squareup.com/dashboard/customers/directory
Export all customers as a CSV using this priority order:
1. **Use the built-in Export button** — Click the "Import / Export" button in the top-right, select "Export customers", and confirm. Square will process the export asynchronously.
   - Make sure to wait for the export to be complete.
   - After triggering the export, **re-open the Import/Export dialog** — when the export is ready, Square shows a "A CSV file containing your customers is ready for download" message with a **Download** button inside that same dialog. Click Download.
   - Once the browser download has been initiated, you are done. The file will be retrieved via the Browserbase Session Downloads API externally — do not attempt to capture the URL or save the file yourself.`;

defineFn(
  "square-client-packages-agent",
  async (ctx) => {
    let agent: Awaited<ReturnType<typeof runSessionTask>>;
    try {
      agent = await runSessionTask(ctx.session.id, INSTRUCTION);
    } catch (error) {
      agent = {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        steps: 0,
      };
    }

    const bb = new Browserbase({ apiKey: BROWSERBASE_API_KEY });
    let customerCount = 0;
    let rows = 0;
    let mapped = false;
    let error: string | null = null;
    let s: Awaited<ReturnType<typeof openSquareSession>> | undefined;
    try {
      // 2) read the synced customers export → every Square Customer ID + name
      const zip = await waitForDownloadZip(bb, ctx.session.id, {
        timeoutMs: 90_000,
        intervalMs: 4_000,
      });
      const square = readZipEntry(zip, ".csv");
      const objs = parseCsvObjects(square.text);
      const nameByToken: Record<string, string> = Object.create(null);
      const seenTokens = new Set<string>();
      const tokens: string[] = [];
      for (const o of objs) {
        const id = (o["Square Customer ID"] || "").trim();
        if (!id) throw new Error("customer export contains a row without a Square Customer ID");
        if (seenTokens.has(id)) throw new Error("customer export contains duplicate Square Customer IDs");
        seenTokens.add(id);
        tokens.push(id);
        const name = `${o["First Name"] || ""} ${o["Last Name"] || ""}`.trim();
        if (name) nameByToken[id] = name;
      }
      customerCount = tokens.length;
      if (!tokens.length)
        throw new Error("no Square Customer IDs found in the export CSV");
      // 3) token-sourced packs + 4) deliver
      s = await openSquareSession(ctx, {
        startUrl: "https://app.squareup.com/dashboard/customers/directory",
      });
      const res = (await s.page.evaluate(
        buildExtractPacksForTokens(tokens, nameByToken),
      )) as { rows?: any[]; complete?: boolean; customersProbed?: number; error?: string };
      if (!res || res.error || res.complete !== true || res.customersProbed !== tokens.length || !Array.isArray(res.rows))
        throw new Error("package extraction did not complete for every customer");
      const pkgRows = res.rows;
      rows = pkgRows.length;
      await deliverCsv(
        s.page,
        s.bb,
        s.sessionId,
        "client-packages.csv",
        clientPackagesCsv(pkgRows),
      );
      mapped = true;
    } catch (e: any) {
      error = "Client package export failed before delivery completed";
    } finally {
      if (s) await s.close();
    }

    return {
      ok: mapped,
      sessionId: ctx.session.id,
      filename: "client-packages.csv",
      customerCount,
      rows,
      mapped,
      error,
      agent,
    };
  },
  {
    parametersSchema: workflowParams,
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
