import Browserbase from "@browserbasehq/sdk";

import { requireContextCapability } from "../../../../../server/context-capability";

export const runtime = "nodejs";

const SAFE_ID = /^[a-zA-Z0-9_-]{1,128}$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; pageId: string }> },
) {
  const { sessionId, pageId } = await params;
  if (!SAFE_ID.test(sessionId) || !SAFE_ID.test(pageId)) {
    return Response.json(
      { error: "A valid session ID and page ID are required." },
      { status: 400 },
    );
  }

  try {
    requireContextCapability(request);
  } catch {
    return Response.json({ error: "Replay access denied." }, { status: 403 });
  }

  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Browserbase is not configured." }, { status: 503 });
  }

  try {
    const browserbase = new Browserbase({ apiKey });
    const playlist = await browserbase.sessions.replays.retrievePage(sessionId, pageId);
    return new Response(await playlist.text(), {
      headers: {
        "cache-control": "no-store",
        "content-type": "application/vnd.apple.mpegurl",
      },
    });
  } catch {
    return Response.json({ error: "The replay page is not available." }, { status: 404 });
  }
}
