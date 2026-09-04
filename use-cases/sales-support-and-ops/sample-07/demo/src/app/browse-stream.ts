export type Listing = { address: string; price: string; beds: string; baths: string; sqft: string; link: string; details: string };
export type BrowseOutcome = "completed" | "error" | "interrupted";
export type LogEntry = {
  type: "status" | "step" | "result" | "error" | "done" | "session" | "action" | "thought";
  message: string;
  data?: Listing[];
  sessionId?: string;
  debugUrl?: string;
  toolName?: string;
  icon?: string;
  step?: number;
  outcome?: "completed" | "error" | "incomplete";
};

export class BrowseStreamError extends Error {
  readonly outcome: BrowseOutcome;
  constructor(message: string, outcome: BrowseOutcome) {
    super(message);
    this.name = "BrowseStreamError";
    this.outcome = outcome;
  }
}

const malformed = (): never => { throw new BrowseStreamError("The server sent an invalid event stream.", "error"); };
// Frame limit counts decoded UTF-8 bytes with CRLF normalized to one newline.
// The separate total limit counts exact wire bytes, including both CRLF bytes.
const MAX_FRAME_BYTES = 1024 * 1024;
const MAX_STREAM_BYTES = 8 * 1024 * 1024;

function parseEntry(data: string): LogEntry {
  let value: unknown;
  try { value = JSON.parse(data); } catch { return malformed(); }
  if (!value || typeof value !== "object" || Array.isArray(value)) return malformed();
  const item = value as Record<string, unknown>;
  const types = ["status", "step", "result", "error", "done", "session", "action", "thought"];
  if (typeof item.type !== "string" || !types.includes(item.type) || typeof item.message !== "string") return malformed();
  for (const key of ["sessionId", "debugUrl", "toolName", "icon"]) {
    if (item[key] !== undefined && typeof item[key] !== "string") return malformed();
  }
  if (item.step !== undefined && (typeof item.step !== "number" || !Number.isSafeInteger(item.step) || item.step < 0)) return malformed();
  if (item.outcome !== undefined && !["completed", "error", "incomplete"].includes(item.outcome as string)) return malformed();
  if (item.type === "done" && item.outcome === undefined) return malformed();
  if (item.type === "session" && typeof item.sessionId !== "string") return malformed();
  if (item.type === "result" && !Array.isArray(item.data)) return malformed();
  if (item.data !== undefined) {
    if (!Array.isArray(item.data)) return malformed();
    for (const listing of item.data) {
      if (!listing || typeof listing !== "object" || Array.isArray(listing) || ["address", "price", "beds", "baths", "sqft", "link", "details"].some(key => typeof listing[key] !== "string")) return malformed();
    }
  }
  const entry: Record<string, unknown> = {};
  for (const key of ["type", "message", "data", "sessionId", "debugUrl", "toolName", "icon", "step", "outcome"]) {
    if (item[key] !== undefined) entry[key] = item[key];
  }
  return entry as LogEntry;
}

/** Streams progress immediately, but accepts a terminal outcome only after a clean EOF. */
export async function consumeBrowseStream(response: Response, onEntry: (entry: LogEntry) => void): Promise<BrowseOutcome> {
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new BrowseStreamError(`Request failed (HTTP ${response.status}). Please try again.`, "error");
  }
  if (response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "text/event-stream" || !response.body) {
    await response.body?.cancel().catch(() => {});
    throw new BrowseStreamError("The server did not return an event stream.", "error");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let totalBytes = 0, frameBytes = 0, line = "", afterCR = false;
  let dataLines: string[] = [];
  let terminal: LogEntry | null = null;
  let sawError = false;
  const finishLine = () => {
    if (line === "") {
      if (dataLines.length) {
        if (terminal) malformed();
        const entry = parseEntry(dataLines.join("\n"));
        if (entry.type === "done") terminal = entry;
        else {
          if (entry.type === "error") sawError = true;
          onEntry(entry);
        }
      }
      dataLines = [];
      frameBytes = 0;
    } else if (line === "data" || line.startsWith("data:")) {
      let data = line === "data" ? "" : line.slice(5);
      if (data.startsWith(" ")) data = data.slice(1);
      dataLines.push(data);
    }
    line = "";
  };
  const consumeText = (text: string) => {
    for (const character of text) {
      if (afterCR && character === "\n") { afterCR = false; continue; }
      afterCR = false;
      const code = character.codePointAt(0)!;
      frameBytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
      if (frameBytes > MAX_FRAME_BYTES) throw new BrowseStreamError("An event exceeded the stream size limit.", "error");
      if (character === "\n" || character === "\r") {
        finishLine();
        afterCR = character === "\r";
      } else line += character;
    }
  };
  try {
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try { chunk = await reader.read(); }
      catch { throw new BrowseStreamError("The event stream was interrupted. Please try again.", "interrupted"); }
      if (chunk.done) break;
      totalBytes += chunk.value.byteLength;
      if (totalBytes > MAX_STREAM_BYTES) throw new BrowseStreamError("The event stream exceeded its size limit.", "error");
      let text: string;
      try { text = decoder.decode(chunk.value, { stream: true }); } catch { return malformed(); }
      consumeText(text);
    }
    try { consumeText(decoder.decode()); } catch (error) {
      if (error instanceof BrowseStreamError) throw error;
      return malformed();
    }
    if (line || dataLines.length) {
      if (terminal) return malformed();
      throw new BrowseStreamError("The event stream ended before completion. Please try again.", "interrupted");
    }
    // Assignment occurs in the frame callback, outside TypeScript's local control-flow analysis.
    const done = terminal as LogEntry | null;
    if (!done) throw new BrowseStreamError("The event stream ended before completion. Please try again.", "interrupted");
    const outcome: BrowseOutcome = sawError || done.outcome === "error" ? "error" : done.outcome === "incomplete" ? "interrupted" : "completed";
    onEntry(sawError && done.outcome !== "error" ? { ...done, outcome: "error", message: "Session ended with an error." } : done);
    return outcome;
  } finally {
    try { await reader.cancel(); } catch { /* Cleanup cannot turn an interrupted stream into success. */ }
    reader.releaseLock();
  }
}
