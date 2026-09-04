import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Browserbase from "@browserbasehq/sdk";
import { loadConfig } from "./config.js";

/** Browserbase SDK client, authed from BROWSERBASE_API_KEY. */
export function makeBrowserbase(): Browserbase {
  const cfg = loadConfig();
  return new Browserbase({ apiKey: cfg.browserbaseApiKey });
}

/** Create a fresh, empty context and return its id. */
export async function createContext(bb: Browserbase): Promise<string> {
  const ctx = await bb.contexts.create({});
  return ctx.id;
}

/**
 * Fetch the live-view (fullscreen debugger) URL for a session. Always call this
 * AFTER the session exists and per session — these URLs are session-scoped.
 */
export async function liveViewUrl(
  bb: Browserbase,
  sessionId: string,
): Promise<string> {
  const dbg = await bb.sessions.debug(sessionId);
  return dbg.debuggerFullscreenUrl;
}

/** Ask Browserbase to end a session. For a persist:true context, auth is flushed on end. */
export async function releaseSession(
  bb: Browserbase,
  sessionId: string,
): Promise<void> {
  await bb.sessions.update(sessionId, { status: "REQUEST_RELEASE" });
}

/**
 * Fetch a session's final status and server-measured duration for the summary table.
 * Tolerant: returns nulls if the lookup fails so it can't break the run summary.
 */
export async function getSessionStatus(
  bb: Browserbase,
  sessionId: string,
): Promise<{ status: string | null; serverDurationMs: number | null }> {
  try {
    const s = await bb.sessions.retrieve(sessionId);
    const started = s.startedAt ? Date.parse(s.startedAt) : NaN;
    const ended = s.endedAt ? Date.parse(s.endedAt) : NaN;
    const serverDurationMs =
      Number.isFinite(started) && Number.isFinite(ended)
        ? ended - started
        : null;
    return { status: s.status ?? null, serverDurationMs };
  } catch {
    return { status: null, serverDurationMs: null };
  }
}

/** Poll until a session is no longer RUNNING (so we know persist has flushed). */
export async function waitUntilReleased(
  bb: Browserbase,
  sessionId: string,
  { timeoutMs = 30_000, intervalMs = 1_500 } = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const s = await bb.sessions.retrieve(sessionId);
    if (s.status !== "RUNNING") return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  // Non-fatal: the release was requested; it may just be taking longer to tear down.
}

// An empty ZIP archive is ~22 bytes (just an end-of-central-directory record).
// Anything at/under this is "no download captured yet".
const EMPTY_ZIP_MAX_BYTES = 30;

/**
 * Retrieve files downloaded during a session. Browserbase syncs in-browser downloads
 * to storage ASYNCHRONOUSLY, so we poll `sessions.downloads.list` (which returns a ZIP)
 * until it's non-empty or we time out. Call this while the session is still OPEN — closing
 * it first can lose an in-flight download.
 *
 * On success: writes <fileBase>.zip into destDir (fileBase defaults to the session id),
 * best-effort unzips it (via the system `unzip`, falling back to leaving the zip), and returns
 * the zip path. Returns null if no download ever materialized (the common case for non-download
 * workflows).
 */
export async function fetchSessionDownloads(
  bb: Browserbase,
  sessionId: string,
  destDir: string,
  {
    timeoutMs = 60_000,
    intervalMs = 3_000,
    fileBase,
  }: { timeoutMs?: number; intervalMs?: number; fileBase?: string } = {},
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    let bytes: Buffer | undefined;
    try {
      const res = await bb.sessions.downloads.list(sessionId);
      bytes = Buffer.from(await res.arrayBuffer());
    } catch {
      // transient — retry until the deadline
    }

    if (bytes && bytes.byteLength > EMPTY_ZIP_MAX_BYTES) {
      mkdirSync(destDir, { recursive: true });
      const zipPath = join(destDir, `${fileBase ?? sessionId}.zip`);
      writeFileSync(zipPath, bytes);
      try {
        // A saved response is a deliverable only after the archive structure validates.
        execFileSync("unzip", ["-t", zipPath], { stdio: "ignore" });
        const extractDir = join(destDir, "extracted");
        mkdirSync(extractDir, { recursive: true });
        execFileSync("unzip", [zipPath, "-d", extractDir], {
          stdio: "ignore",
        });
      } catch {
        // Preserve the bytes for diagnosis, but do not report an unverified artifact.
        return null;
      }
      return zipPath;
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return null;
}
