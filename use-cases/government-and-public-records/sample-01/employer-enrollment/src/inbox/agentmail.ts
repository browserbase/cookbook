import { AgentMailClient } from "agentmail";
import { retry, wait } from "../utils.js";

export interface Inbox {
  /** Full email address — AgentMail uses the address itself as the inbox identifier. */
  inboxId: string;
}

export interface InboxMessage {
  messageId: string;
  subject?: string;
  from?: string;
  to?: string | string[];
  text?: string;
  extractedText?: string;
  extractedHtml?: string;
  receivedAt?: string;
}

export class InboxTimeoutError extends Error {
  constructor(
    public inboxId: string,
    public timeoutMs: number,
  ) {
    super(`Timed out after ${timeoutMs}ms waiting for a message in ${inboxId}`);
    this.name = "InboxTimeoutError";
  }
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
  opts: { clientId?: string; displayName?: string } = {},
): Promise<Inbox> {
  const created = await retry(() =>
    client().inboxes.create({
      clientId: opts.clientId,
      displayName: opts.displayName,
    } as Parameters<AgentMailClient["inboxes"]["create"]>[0]),
  );
  // SDK passes through raw JSON, which is snake_case (inbox_id, email).
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

export async function deleteInbox(inboxId: string): Promise<void> {
  const apiKey = process.env.AGENTMAIL_API_KEY;
  if (!apiKey) return;
  try {
    await retry(async () => {
      const res = await fetch(
        `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${apiKey}` } },
      );
      if (!res.ok && res.status !== 404) {
        const err = new Error(
          `AgentMail DELETE returned ${res.status}: ${await res.text()}`,
        ) as Error & { status: number };
        err.status = res.status;
        throw err;
      }
    });
  } catch {
    /* best-effort cleanup */
  }
}

export async function waitForMessage(opts: {
  inboxId: string;
  matchFn?: (msg: InboxMessage) => boolean;
  timeoutMs?: number;
  pollMs?: number;
  sinceMs?: number;
  fetchFullBody?: boolean;
}): Promise<InboxMessage> {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const pollMs = opts.pollMs ?? 5_000;
  // Pad by 5s to handle clock skew + second-precision timestamps from senders
  // that round to the nearest second (e.g. Substack). Larger windows risk
  // picking up stale messages on a reused inbox.
  const sinceMs = opts.sinceMs ?? Date.now() - 5_000;
  const deadline = Date.now() + timeoutMs;
  const matchFn = opts.matchFn ?? (() => true);
  const fetchFullBody = opts.fetchFullBody ?? true;

  let pollCount = 0;
  while (Date.now() < deadline) {
    pollCount++;
    const res = await retry(() =>
      client().inboxes.messages.list(opts.inboxId, { limit: 25 }),
    );
    const raw = ((res as unknown as { messages?: unknown[] }).messages ??
      []) as unknown[];
    const messages = raw.map(normalizeMessage);

    if (pollCount === 1 || pollCount % 6 === 0) {
      console.error(
        `[waitForMessage] poll #${pollCount}: ${messages.length} message(s) in inbox`,
      );
    }

    const fresh = messages
      // Allow messages with unknown timestamps through — the list endpoint
      // sometimes omits received_at, and we created the inbox 0s ago anyway.
      .filter((m) => {
        const t = msgTimestamp(m);
        return t === 0 || t >= sinceMs;
      })
      .sort((a, b) => msgTimestamp(b) - msgTimestamp(a));

    for (const candidate of fresh) {
      // List endpoint may return a summary without bodies — fetch full message.
      let complete = candidate;
      if (
        fetchFullBody &&
        !candidate.extractedHtml &&
        !candidate.extractedText &&
        !candidate.text
      ) {
        const full = await retry(() =>
          client().inboxes.messages.get(opts.inboxId, candidate.messageId),
        );
        complete = normalizeMessage(full);
      }
      if (matchFn(complete)) return complete;
    }
    await wait(pollMs);
  }
  throw new InboxTimeoutError(opts.inboxId, timeoutMs);
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
    to: m.to as string | string[] | undefined,
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
