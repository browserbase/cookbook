import { timingSafeEqual } from "node:crypto";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const MAX_CONCURRENT = 2;
const clients = new Map<string, { started: number[]; active: number }>();

function sameSecret(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function authorizeBrowserRequest(request: Request): Response | undefined {
  const expected = process.env.EXPORT_API_TOKEN;
  if (!expected || expected.length < 24) {
    return Response.json({ error: "Server access token is not configured" }, { status: 503 });
  }
  const header = request.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!sameSecret(supplied, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export function acquireBrowserRequest(request: Request): (() => void) | Response {
  const now = Date.now();
  const identity = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "local";
  const entry = clients.get(identity) ?? { started: [], active: 0 };
  entry.started = entry.started.filter(value => now - value < WINDOW_MS);
  if (entry.started.length >= MAX_REQUESTS) {
    return Response.json({ error: "Request limit exceeded" }, { status: 429 });
  }
  if (entry.active >= MAX_CONCURRENT) {
    return Response.json({ error: "Too many active requests" }, { status: 429 });
  }
  entry.started.push(now);
  entry.active += 1;
  clients.set(identity, entry);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    entry.active = Math.max(0, entry.active - 1);
  };
}

export async function readExportUrl(request: Request): Promise<string | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request" }, { status: 400 });
  }
  const value = body && typeof body === "object" && "url" in body ? (body as { url?: unknown }).url : undefined;
  if (typeof value !== "string") return Response.json({ error: "URL is required" }, { status: 400 });
  let url: URL;
  try { url = new URL(value); } catch { return Response.json({ error: "Valid URL is required" }, { status: 400 }); }
  if (url.protocol !== "https:" || url.username || url.password) {
    return Response.json({ error: "Only credential-free HTTPS URLs are accepted" }, { status: 400 });
  }
  return url.href;
}
