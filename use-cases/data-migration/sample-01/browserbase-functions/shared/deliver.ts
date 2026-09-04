import type Browserbase from "@browserbasehq/sdk";
import type { Page } from "playwright-core";
import { readDownloadZip } from "./download-zip";

const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;
type PollOptions = { timeoutMs?: number; intervalMs?: number };
type Entry = ReturnType<typeof readDownloadZip>[number];

/** Trigger a real browser download from the page context (Blob + anchor click) so Browserbase captures it. */
export async function triggerCsvDownload(
  page: Page,
  filename: string,
  csvText: string,
): Promise<void> {
  await page.evaluate(
    ({ name, text }: { name: string; text: string }) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
    { name: filename, text: csvText },
  );
}

async function readBoundedResponse(response: Response): Promise<Uint8Array> {
  // The SDK's Node fetch shim returns a Node stream; native fetch returns a Web stream.
  const body = response.body as unknown as AsyncIterable<Uint8Array> | null;
  if (!body || typeof body[Symbol.asyncIterator] !== "function") throw new Error("Download response has no readable body");
  const chunks: Uint8Array[] = []; let size = 0;
  for await (const value of body) {
    if (!(value instanceof Uint8Array)) throw new Error("Invalid download stream chunk");
    size += value.byteLength;
    if (size > MAX_DOWNLOAD_BYTES) throw new Error("Download archive exceeds size limit");
    chunks.push(value);
  }
  const result = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

async function waitForArchive(
  bb: Browserbase, sessionId: string, accept: (entries: Entry[]) => boolean,
  { timeoutMs = 90_000, intervalMs = 3_000 }: PollOptions = {},
): Promise<Uint8Array> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isFinite(intervalMs) || intervalMs < 0) throw new Error("Invalid download polling limits");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    try {
      const remaining = deadline - Date.now();
      const bytes = await Promise.race([
        (async () => readBoundedResponse(await bb.sessions.downloads.list(sessionId, { timeout: Math.max(1, remaining), maxRetries: 0, signal: controller.signal })))(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Download request timed out")), Math.max(1, remaining)); }),
      ]);
      const entries = readDownloadZip(bytes);
      if (accept(entries)) return bytes;
    } catch {
      // Incomplete snapshots and transient errors never provide delivery evidence.
    } finally { if (timer) clearTimeout(timer); controller.abort(); }
    const remaining = deadline - Date.now();
    if (remaining > 0) await new Promise(resolve => setTimeout(resolve, Math.min(intervalMs, remaining)));
  }
  throw new Error("Expected download did not sync as a valid archive before the deadline");
}

/** Native export polling: requires a valid archive with at least one file. */
export async function waitForDownloadZip(bb: Browserbase, sessionId: string, options: PollOptions = {}): Promise<Uint8Array> {
  return waitForArchive(bb, sessionId, entries => entries.length > 0, options);
}

/** A suffix must identify exactly one valid file; never fall back to an unrelated entry. */
export function readZipEntry(zip: Uint8Array, preferSuffix = ".csv"): { name: string; text: string } {
  const matching = readDownloadZip(zip).filter(entry => entry.name.endsWith(preferSuffix));
  if (matching.length !== 1) throw new Error("Download suffix must identify exactly one file");
  return { name: matching[0]!.name, text: new TextDecoder("utf-8", { fatal: true }).decode(matching[0]!.data) };
}

/** Confirm a newly named CSV with exactly the expected UTF-8 bytes. */
export async function deliverCsv(
  page: Page, bb: Browserbase, sessionId: string, filename: string, csvText: string,
  options: PollOptions = {},
): Promise<number> {
  if (filename.length > 200 || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.csv$/.test(filename)) throw new Error("Expected a plain CSV filename");
  const expected = Buffer.from(csvText, "utf8");
  if (expected.length > 20 * 1024 * 1024) throw new Error("CSV exceeds entry size limit");
  const matches = (entries: Entry[]) => entries.filter(entry => entry.name.split("/").at(-1) === filename);
  const before = await waitForArchive(bb, sessionId, () => true, options);
  if (matches(readDownloadZip(before)).length) throw new Error("Target filename already exists in this session; use a fresh session or a unique filename");
  await triggerCsvDownload(page, filename, csvText);
  const zip = await waitForArchive(bb, sessionId, entries => {
    const found = matches(entries);
    return found.length === 1 && found[0]!.data.equals(expected);
  }, options);
  return zip.byteLength;
}
