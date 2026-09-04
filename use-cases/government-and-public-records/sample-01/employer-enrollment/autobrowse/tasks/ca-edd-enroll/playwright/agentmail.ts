// AgentMail helpers — concise standalone wrapper for the deliverable.
// Mirrors ca-edd-demo/src/inbox/{agentmail,extractors}.ts but trimmed to what
// this script needs.

import { AgentMailClient } from "agentmail";

export interface Inbox {
  inboxId: string;
}

export interface InboxMessage {
  messageId: string;
  subject?: string;
  from?: string;
  text?: string;
  extractedText?: string;
  extractedHtml?: string;
  receivedAt?: string;
}

let _client: AgentMailClient | null = null;
function client(): AgentMailClient {
  if (_client) return _client;
  const apiKey = process.env.AGENTMAIL_API_KEY;
  if (!apiKey)
    throw new Error(
      "Missing AGENTMAIL_API_KEY — get one at https://console.agentmail.to",
    );
  _client = new AgentMailClient({ apiKey });
  return _client;
}

export async function createInbox(
  opts: { clientId?: string } = {},
): Promise<Inbox> {
  const created = await client().inboxes.create({
    clientId: opts.clientId,
  } as Parameters<AgentMailClient["inboxes"]["create"]>[0]);
  const raw = created as unknown as {
    inbox_id?: string;
    inboxId?: string;
    email?: string;
    id?: string;
  };
  const inboxId = raw.inbox_id ?? raw.inboxId ?? raw.email ?? raw.id;
  if (!inboxId)
    throw new Error(
      `AgentMail.create returned no inboxId: ${JSON.stringify(created)}`,
    );
  return { inboxId };
}

export async function waitForMessage(opts: {
  inboxId: string;
  matchFn?: (msg: InboxMessage) => boolean;
  timeoutMs?: number;
  pollMs?: number;
  sinceMs?: number;
}): Promise<InboxMessage> {
  const timeoutMs = opts.timeoutMs ?? 180_000;
  const pollMs = opts.pollMs ?? 5_000;
  const sinceMs = opts.sinceMs ?? Date.now() - 5_000;
  const deadline = Date.now() + timeoutMs;
  const matchFn = opts.matchFn ?? (() => true);

  while (Date.now() < deadline) {
    const res = await client().inboxes.messages.list(opts.inboxId, {
      limit: 25,
    });
    const raw = ((res as unknown as { messages?: unknown[] }).messages ??
      []) as unknown[];
    const messages = raw.map(normalizeMessage);

    const fresh = messages
      .filter((m) => {
        const t = msgTimestamp(m);
        return t === 0 || t >= sinceMs;
      })
      .sort((a, b) => msgTimestamp(b) - msgTimestamp(a));

    for (const candidate of fresh) {
      let complete = candidate;
      if (
        !candidate.extractedHtml &&
        !candidate.extractedText &&
        !candidate.text
      ) {
        const full = await client().inboxes.messages.get(
          opts.inboxId,
          candidate.messageId,
        );
        complete = normalizeMessage(full);
      }
      if (matchFn(complete)) return complete;
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for a message in ${opts.inboxId}`,
  );
}

function normalizeMessage(raw: unknown): InboxMessage {
  const m = raw as Record<string, unknown>;
  const pick = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = m[k];
      if (typeof v === "string" && v.length > 0) return v;
    }
    return undefined;
  };
  return {
    messageId: pick("message_id", "messageId", "id") ?? "",
    subject: pick("subject"),
    from: pick("from"),
    text: pick("text"),
    extractedText: pick("extracted_text", "extractedText"),
    extractedHtml: pick("extracted_html", "extractedHtml", "html"),
    receivedAt: pick("received_at", "receivedAt", "timestamp", "created_at"),
  };
}

function msgTimestamp(m: InboxMessage): number {
  if (!m.receivedAt) return 0;
  const t = Date.parse(m.receivedAt);
  return Number.isFinite(t) ? t : 0;
}

// ────────────────────────────────────────────────────────────────────────────
// Extractors

const HREF_RE = /<a[^>]*\shref\s*=\s*["']([^"']+)["'][^>]*>/gi;
const URL_RE = /https?:\/\/[^\s<>"')]+/g;
const REJECT_LINK_RE =
  /unsubscribe|preferences|mailto:|tel:|^#|notification-settings/i;

export function extractConfirmationLink(
  msg: InboxMessage,
  opts: { allowedHosts?: readonly string[]; hostMatch?: RegExp } = {},
): string | null {
  const links = collectLinks(msg)
    .filter((l) => !REJECT_LINK_RE.test(l))
    .filter((link) => {
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
    });
  return links[0] ?? null;
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

export function extractOtpCode(
  msg: InboxMessage,
  opts: { length?: number } = {},
): string | null {
  const length = opts.length ?? 6;
  const body =
    msg.extractedText ?? msg.text ?? stripTags(msg.extractedHtml ?? "");
  if (!body) return null;

  const codeRe = new RegExp(`\\b(\\d{${length}})\\b`, "g");
  const candidates: Array<{ code: string; index: number }> = [];
  for (const m of body.matchAll(codeRe)) {
    if (m.index === undefined) continue;
    candidates.push({ code: m[1], index: m.index });
  }
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].code;

  // Multiple matches — prefer the one nearest an OTP keyword.
  const OTP_KEYWORDS =
    /\b(code|verification|verify|one[- ]time|otp|passcode)\b/i;
  const scored = candidates.map((c) => {
    const window = 80;
    const slice = body.slice(
      Math.max(0, c.index - window),
      Math.min(body.length, c.index + window),
    );
    const m = slice.match(OTP_KEYWORDS);
    const distance =
      m && m.index !== undefined
        ? Math.abs(Math.max(0, c.index - window) + m.index - c.index)
        : Number.POSITIVE_INFINITY;
    return { ...c, distance };
  });
  scored.sort((a, b) => a.distance - b.distance);
  return scored[0].code;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
