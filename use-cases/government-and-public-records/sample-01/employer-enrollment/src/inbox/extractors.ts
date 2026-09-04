import type { InboxMessage } from "./agentmail.js";

const HREF_RE = /<a[^>]*\shref\s*=\s*["']([^"']+)["'][^>]*>/gi;
const URL_RE = /https?:\/\/[^\s<>"')]+/g;
const REJECT_LINK_RE =
  /unsubscribe|preferences|mailto:|tel:|^#|notification-settings/i;

export function extractConfirmationLink(
  msg: InboxMessage,
  opts: { allowedHosts?: readonly string[]; hostMatch?: RegExp; prefer?: "first" | "longest" } = {},
): string | null {
  const links = collectLinks(msg);
  const filtered = links
    .filter((l) => !REJECT_LINK_RE.test(l))
    .filter((link) => isAllowedWebLink(link, opts));
  if (filtered.length === 0) return null;
  if (opts.prefer === "longest") {
    return filtered.reduce((a, b) => (b.length > a.length ? b : a));
  }
  return filtered[0];
}

function isAllowedWebLink(link: string, opts: { allowedHosts?: readonly string[]; hostMatch?: RegExp }): boolean {
  let url: URL;
  try { url = new URL(link); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  const hostname = url.hostname.toLowerCase();
  if (opts.allowedHosts) return opts.allowedHosts.some((host) => {
    const root = host.toLowerCase();
    return hostname === root || hostname.endsWith(`.${root}`);
  });
  if (!opts.hostMatch) return true;
  opts.hostMatch.lastIndex = 0;
  return opts.hostMatch.test(hostname);
}

function collectLinks(msg: InboxMessage): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const html = msg.extractedHtml ?? "";
  for (const m of html.matchAll(HREF_RE)) {
    const url = decodeEntities(m[1]).trim();
    if (url && !seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  const text = msg.extractedText ?? msg.text ?? "";
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0].replace(/[.,;:)\]]+$/, "");
    if (url && !seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/g, "/")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const OTP_KEYWORDS =
  /\b(code|verification|verify|one[- ]time|otp|passcode|pin|security code|confirm)\b/i;

export function extractOtpCode(
  msg: InboxMessage,
  opts: { length?: number; pattern?: RegExp } = {},
): string | null {
  const length = opts.length ?? 6;
  const body =
    msg.extractedText ?? msg.text ?? stripTags(msg.extractedHtml ?? "");
  if (!body) return null;

  if (opts.pattern) {
    const m = body.match(opts.pattern);
    return m ? (m[1] ?? m[0]) : null;
  }

  const codeRe = new RegExp(`\\b(\\d{${length}})\\b`, "g");
  const candidates: Array<{ code: string; index: number }> = [];
  for (const m of body.matchAll(codeRe)) {
    if (m.index === undefined) continue;
    candidates.push({ code: m[1], index: m.index });
  }
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].code;

  // Multiple matches — prefer the one nearest an OTP keyword.
  const scored = candidates.map((c) => ({
    ...c,
    distance: nearestKeywordDistance(body, c.index),
  }));
  scored.sort((a, b) => a.distance - b.distance);
  return scored[0].code;
}

function nearestKeywordDistance(body: string, index: number): number {
  const window = 80;
  const start = Math.max(0, index - window);
  const end = Math.min(body.length, index + window);
  const slice = body.slice(start, end);
  const m = slice.match(OTP_KEYWORDS);
  if (!m || m.index === undefined) return Number.POSITIVE_INFINITY;
  return Math.abs(start + m.index - index);
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
