import type { Page } from "@browserbasehq/stagehand";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, open, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export type SavedStatement = { path: string; bytes: number; sha256: string };

export async function fetchStatement(origin: string) {
  const limit = 1024 * 1024;
  if (location.origin !== origin || location.pathname !== "/documents") throw new Error("The verified portal document page is required.");
  const url = new URL("/public/tax-statement-2024.pdf", origin).href;
  const links = [...document.querySelectorAll<HTMLAnchorElement>("a[download]")].filter(link => link.href === url);
  if (links.length !== 1) throw new Error("Expected one synthetic statement link.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { credentials: "same-origin", redirect: "error", cache: "no-store", signal: controller.signal });
    if (response.status !== 200 || !/^application\/pdf(?:;|$)/i.test(response.headers.get("content-type") ?? "") || !response.body) {
      throw new Error("The portal did not return a PDF download.");
    }
    const length = response.headers.get("content-length");
    if (length !== null && (!/^\d+$/.test(length) || Number(length) === 0 || Number(length) > limit)) throw new Error("Invalid statement response length.");
    const reader = response.body.getReader();
    let bytes = 0;
    let binary = "";
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > limit) { controller.abort(); throw new Error("Statement exceeds the demo download limit."); }
        for (const byte of chunk.value) binary += String.fromCharCode(byte);
      }
    } finally { reader.releaseLock(); }
    if (bytes === 0 || (length !== null && bytes !== Number(length))) throw new Error("The statement response is incomplete.");
    return { base64: btoa(binary), bytes };
  } finally { clearTimeout(timeout); }
}

export async function downloadStatement(page: Pick<Page, "evaluate">, portalOrigin: string, outputRoot = fileURLToPath(new URL("./downloads/", import.meta.url))): Promise<SavedStatement> {
  const origin = new URL(portalOrigin);
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("A portal origin is required.");
  const downloaded: unknown = await page.evaluate(fetchStatement, origin.origin);
  if (!downloaded || typeof downloaded !== "object" || !("base64" in downloaded) || typeof downloaded.base64 !== "string" ||
      !("bytes" in downloaded) || typeof downloaded.bytes !== "number" || !Number.isSafeInteger(downloaded.bytes) ||
      downloaded.bytes < 1 || downloaded.bytes > 1024 * 1024 || downloaded.base64.length > 1_398_104) throw new Error("Invalid browser download result.");
  const bytes = Buffer.from(downloaded.base64, "base64");
  if (bytes.length !== downloaded.bytes || bytes.toString("base64") !== downloaded.base64) throw new Error("Invalid download encoding.");
  const expected = await readFile(new URL("./public/tax-statement-2024.pdf", import.meta.url));
  if (!bytes.equals(expected)) throw new Error("Downloaded PDF does not match the packaged synthetic statement.");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await mkdir(outputRoot, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(join(outputRoot, "statement-"));
  const path = join(directory, "tax-statement-2024.pdf");
  try {
    const file = await open(path, "wx", 0o600);
    try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
    const saved = await readFile(path);
    if (!saved.equals(bytes)) throw new Error("Saved statement verification failed.");
    return { path, bytes: saved.length, sha256 };
  } catch (error) {
    try { await rm(directory, { recursive: true, force: true }); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], "Statement write and cleanup failed."); }
    throw error;
  }
}
