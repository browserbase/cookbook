import { readdir } from "node:fs/promises";
import path from "node:path";

import { Client, type MessageStreamEvent } from "eve/client";

export const runtime = "nodejs";
const COOKIE = "browsie_task_refs_v1";
const ID = /^[a-zA-Z0-9_-]{8,128}$/;
const LIMIT = 30;
const DEV_RECOVERY_LIMIT = 12;

export async function GET(request: Request) {
  let ids = readRefs(request.headers.get("cookie"));
  const hostname = new URL(request.url).hostname;
  const recovered = ids.length === 0 && (hostname === "localhost" || hostname === "127.0.0.1");
  if (recovered) ids = await discoverLocalSessionIds();
  const headers = forwardedHeaders(request.headers);
  const client = new Client({
    host: new URL(request.url).origin,
    headers,
    redirect: "manual",
  });
  const resolved: Array<ReturnType<typeof summarizeTask> | undefined> = [];
  for (let index = 0; index < ids.length; index += 2) {
    resolved.push(
      ...(await Promise.all(
        ids.slice(index, index + 2).map(async (sessionId) => {
          try {
            const snapshot = await client.sessions.attach(sessionId).snapshot();
            return summarizeTask(sessionId, snapshot.events);
          } catch {
            return undefined;
          }
        }),
      )),
    );
  }
  const tasks = sortTasksNewestFirst(
    resolved.filter((task): task is NonNullable<(typeof resolved)[number]> => task !== undefined),
  );
  const responseHeaders = new Headers({ "cache-control": "no-store" });
  if (recovered && tasks.length)
    responseHeaders.set("set-cookie", taskRefsCookie(tasks.map((task) => task.sessionId)));
  return Response.json({ tasks }, { headers: responseHeaders });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    sessionId?: unknown;
    sessionIds?: unknown;
  };
  const requested = [
    ...(typeof body.sessionId === "string" ? [body.sessionId] : []),
    ...(Array.isArray(body.sessionIds) ? body.sessionIds : []),
  ].filter((value): value is string => typeof value === "string" && ID.test(value));
  if (!requested.length) return Response.json({ error: "Invalid task session." }, { status: 400 });
  const refs = [...new Set([...requested, ...readRefs(request.headers.get("cookie"))])].slice(
    0,
    LIMIT,
  );
  return Response.json(
    { ok: true },
    {
      headers: {
        "set-cookie": taskRefsCookie(refs),
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
      ? value.filter((id): id is string => typeof id === "string" && ID.test(id)).slice(0, LIMIT)
      : [];
  } catch {
    return [];
  }
}
function taskRefsCookie(refs: string[]): string {
  return `${COOKIE}=${Buffer.from(JSON.stringify(refs)).toString("base64url")}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`;
}
async function discoverLocalSessionIds(): Promise<string[]> {
  try {
    const entries = await readdir(
      path.join(process.cwd(), ".eve", ".workflow-data", "streams", "runs"),
      { withFileTypes: true },
    );
    return sessionIdsFromRunFiles(
      entries.filter((entry) => entry.isFile()).map((entry) => entry.name),
      DEV_RECOVERY_LIMIT,
    );
  } catch {
    return [];
  }
}
export function sessionIdsFromRunFiles(
  files: readonly string[],
  limit = DEV_RECOVERY_LIMIT,
): string[] {
  return files
    .map((file) => file.match(/^(wrun_[a-zA-Z0-9_-]+)\.json$/)?.[1])
    .filter((id): id is string => Boolean(id && ID.test(id)))
    .sort((left, right) => right.localeCompare(left))
    .slice(0, limit);
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
    state = "idle";
  for (const event of events) {
    if (event.type === "message.received" && title === "Untitled task") {
      const data = event.data as unknown as Record<string, unknown>;
      const text =
        typeof data.message === "string"
          ? data.message
          : typeof data.text === "string"
            ? data.text
            : "";
      if (text) title = text.trim().replace(/\s+/g, " ").slice(0, 64);
    }
    if (event.type === "message.received") updatedAt = event.meta.at || updatedAt;
    else if (event.type === "message.completed") {
      const data = event.data as unknown as Record<string, unknown>;
      if (typeof data.message === "string" && data.message.trim())
        updatedAt = event.meta.at || updatedAt;
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
  };
}
