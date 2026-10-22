import Browserbase from "@browserbasehq/sdk";

import { requireContextCapability } from "../../../server/context-capability";
import { toEmbeddedBrowserbaseLiveViewUrl } from "../../../src/live-view";

export const runtime = "nodejs";

const SESSION_ID = /^[a-zA-Z0-9_-]{8,128}$/;

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId || !SESSION_ID.test(sessionId)) {
    return Response.json({ error: "A valid session ID is required." }, { status: 400 });
  }

  try {
    requireContextCapability(request);
  } catch {
    return Response.json({ error: "Session access denied." }, { status: 403 });
  }

  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Browserbase is not configured." }, { status: 503 });
  }

  const browserbase = new Browserbase({ apiKey });
  try {
    const session = await browserbase.sessions.retrieve(sessionId);
    if (session.status === "PENDING" || session.status === "RUNNING") {
      const debug = await browserbase.sessions.debug(sessionId);
      return Response.json(
        {
          mode: "live",
          status: session.status,
          liveUrl: toEmbeddedBrowserbaseLiveViewUrl(debug.debuggerFullscreenUrl),
        },
        { headers: { "cache-control": "no-store" } },
      );
    }

    try {
      const replay = await browserbase.sessions.replays.retrieve(sessionId);
      return Response.json(
        {
          mode: "replay",
          status: session.status,
          pageCount: replay.pageCount,
          pages: replay.pages,
        },
        { headers: { "cache-control": "no-store" } },
      );
    } catch {
      return Response.json(
        { mode: "processing", status: session.status },
        { headers: { "cache-control": "no-store" } },
      );
    }
  } catch {
    return Response.json({ error: "The Browserbase session is not available." }, { status: 404 });
  }
}
