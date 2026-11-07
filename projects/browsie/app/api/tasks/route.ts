import { Client, type MessageStreamEvent } from "eve/client";

export const runtime = "nodejs";
const COOKIE = "browsie_task_refs_v1";
const ID = /^[a-zA-Z0-9_-]{8,128}$/;

export async function GET(request: Request) {
  const ids = readRefs(request.headers.get("cookie"));
  const headers = forwardedHeaders(request.headers);
  const client = new Client({
    host: new URL(request.url).origin,
    headers,
    redirect: "manual",
  });
  const resolved = (
    await Promise.all(
      ids.map(async (sessionId) => {
        try {
          const snapshot = await client.sessions.attach(sessionId).snapshot();
          const summary = summarizeTask(sessionId, snapshot.events);
          if (!summary.hasUserMessage) return undefined;
          return {
            sessionId: summary.sessionId,
            title: summary.title,
            updatedAt: summary.updatedAt,
            state: summary.state,
          };
        } catch {
          return undefined;
        }
      }),
    )
  ).filter((task) => task !== undefined);
  const tasks = sortTasksNewestFirst(resolved);
  return Response.json({ tasks }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    sessionId?: unknown;
  };
  if (typeof body.sessionId !== "string" || !ID.test(body.sessionId))
    return Response.json({ error: "Invalid task session." }, { status: 400 });
  const refs = [
    body.sessionId,
    ...readRefs(request.headers.get("cookie")).filter((id) => id !== body.sessionId),
  ].slice(0, 30);
  return Response.json(
    { ok: true },
    {
      headers: {
        "set-cookie": `${COOKIE}=${Buffer.from(JSON.stringify(refs)).toString("base64url")}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`,
        "cache-control": "no-store",
      },
    },
  );
}

function readRefs(cookie: string | null): string[] {
  const raw = cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!raw) return [];
  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === "string" && ID.test(id)).slice(0, 30)
      : [];
  } catch {
    return [];
  }
}
function forwardedHeaders(source: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of ["cookie", "authorization", "x-vercel-trusted-oidc-idp-token"]) {
    const value = source.get(name);
    if (value) result[name] = value;
  }
  return result;
}
export function sortTasksNewestFirst<T extends { updatedAt: string }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function summarizeTask(sessionId: string, events: readonly MessageStreamEvent[]) {
  let title = "Untitled task",
    updatedAt = "",
    state = "idle",
    hasUserMessage = false;
  for (const event of events) {
    updatedAt = event.meta.at || updatedAt;
    if (event.type === "message.received" && title === "Untitled task") {
      const data = event.data as unknown as Record<string, unknown>;
      const text =
        typeof data.message === "string"
          ? data.message
          : typeof data.text === "string"
            ? data.text
            : "";
      if (text.trim()) {
        title = text.trim().replace(/\s+/g, " ").slice(0, 64);
        hasUserMessage = true;
      }
    }
    if (event.type === "turn.started" || event.type === "step.started") state = "running";
    else if (event.type === "input.requested") state = "waiting_for_user";
    else if (event.type === "turn.failed" || event.type === "session.failed") state = "failed";
    else if (event.type === "turn.cancelled") state = "canceled";
    else if (event.type === "session.completed") state = "complete";
    else if (event.type === "turn.completed") {
      if (state !== "waiting_for_user") state = "idle";
    } else if (event.type === "session.waiting") {
      if (state !== "waiting_for_user") state = "idle";
    }
  }
  return {
    sessionId,
    title,
    updatedAt: updatedAt || new Date(0).toISOString(),
    state,
    hasUserMessage,
  };
}
