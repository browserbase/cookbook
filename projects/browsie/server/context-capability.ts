import "server-only";

import { randomBytes, timingSafeEqual } from "node:crypto";

export const CONTEXT_CAPABILITY_COOKIE = "browsie_context_capability";
export const CONTEXT_CAPABILITY_HEADER = "x-browsie-context-capability";

export function issueContextCapability(request: Request): {
  token: string;
  cookie: string;
} {
  assertSameOrigin(request);
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    cookie: `${CONTEXT_CAPABILITY_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=21600${isHttps(request) ? "; Secure" : ""}`,
  };
}

export function requireContextCapability(request: Request): void {
  assertSameOrigin(request);
  const supplied = request.headers.get(CONTEXT_CAPABILITY_HEADER);
  const cookie = readCookie(request.headers.get("cookie"), CONTEXT_CAPABILITY_COOKIE);
  if (!supplied || !cookie || !safeEqual(supplied, cookie)) throw new ContextCapabilityError();
}

export class ContextCapabilityError extends Error {}

function assertSameOrigin(request: Request): void {
  const expected = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (origin !== expected && fetchSite !== "same-origin") throw new ContextCapabilityError();
}

function readCookie(header: string | null, name: string): string | undefined {
  return header
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isHttps(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}
