import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

export type AccessDecision = { status: 401 | 403 | 503; error: string } | null;
export function checkAccess(req: Pick<IncomingMessage, "headers" | "method">, env: NodeJS.ProcessEnv): AccessDecision {
  const expected = env.BENCHMARK_ACCESS_TOKEN;
  if (!expected || !/^[a-f0-9]{64}$/i.test(expected)) {
    return { status: 503, error: "Benchmark access is not configured" };
  }
  const header = req.headers?.authorization ?? "";
  let supplied = "";
  if (header.startsWith("Bearer ")) supplied = header.slice(7);
  else if (header.startsWith("Basic ") && header.length <= 512) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    if (decoded.startsWith("benchmark:")) supplied = decoded.slice(10);
  }
  const hash = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(hash(supplied), hash(expected))) {
    return { status: 401, error: "Authentication required" };
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.origin;
    const expectedOrigin = env.BENCHMARK_PUBLIC_ORIGIN ?? `http://${req.headers.host}`;
    if ((origin && origin !== expectedOrigin) || ["cross-site", "same-site"].includes(req.headers["sec-fetch-site"] as string)) {
      return { status: 403, error: "Cross-origin control requests are not allowed" };
    }
  }
  return null;
}

export function validSites(sites: string[]): boolean {
  if (sites.length < 1 || sites.length > 10 || new Set(sites).size !== sites.length) return false;
  return sites.every(site => {
    if (site.length > 2048 || /\s/.test(site)) return false;
    try {
      const url = new URL(site);
      return ["http:", "https:"].includes(url.protocol) && !!url.hostname && !url.username && !url.password;
    } catch { return false; }
  });
}
