import AdmZip from "adm-zip";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export type Statement = { url: string; sha256: string; bytes: number };
export const STATEMENTS: Record<string, Statement> = JSON.parse(
  readFileSync(new URL("./statements.json", import.meta.url), "utf8"),
);
export const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;

export function inspectArchive(payload: Buffer, statements = STATEMENTS): Set<string> {
  if (Object.keys(statements).sort().join() !== "1,2,3,4") throw new Error("Expected four reference quarters");
  const byDigest = new Map(Object.entries(statements).map(([q, item]) => [item.sha256, q]));
  if (byDigest.size !== 4) throw new Error("Quarter reference PDFs must be distinct");
  if (payload.length > MAX_ARCHIVE_BYTES) throw new Error("Download archive exceeds 32 MiB");
  const found = new Set<string>();
  if (!payload.length) return found;
  const entries = new AdmZip(payload).getEntries();
  if (entries.length > 32 || entries.reduce((n, e) => n + e.header.size, 0) > MAX_ARCHIVE_BYTES) {
    throw new Error("Archive has too many entries or expanded bytes");
  }
  const names = new Set<string>();
  for (const entry of entries) {
    const name = entry.entryName;
    if (name.startsWith("/") || name.split("/").includes("..") || name.includes("\\") ||
        name.includes(":") || names.has(name) || ((entry.attr >>> 16) & 0o170000) === 0o120000) {
      throw new Error("Archive member path is unsafe or duplicated");
    }
    names.add(name);
    if (entry.isDirectory) continue;
    const data = entry.getData();
    if (!data.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("Archive contains a non-PDF member");
    const quarter = byDigest.get(createHash("sha256").update(data).digest("hex"));
    if (!quarter) throw new Error("Archive contains an unrecognized or changed statement PDF");
    if (found.has(quarter)) throw new Error("Archive repeats a quarter");
    found.add(quarter);
  }
  return found;
}

export function validateStatementUrls(urls: string[]): string[] {
  if (urls.length !== 4) throw new Error("Expected four FY2025 statement URLs");
  const quarters = new Map<string, string>();
  for (const value of urls) {
    const url = new URL(value);
    const allowed = ["www.apple.com", "images.apple.com", "investor.apple.com"].includes(url.hostname) ||
      (url.hostname === "s2.q4cdn.com" && url.pathname.startsWith("/470004039/"));
    if (url.protocol !== "https:" || !allowed || url.username || url.password || (url.port && url.port !== "443")) {
      throw new Error("Expected an Apple statement URL");
    }
    const name = decodeURIComponent(url.pathname.split("/").at(-1)!);
    const matches = Object.entries(STATEMENTS).filter(([, item]) => new URL(item.url).pathname.split("/").at(-1) === name);
    if (matches.length !== 1 || quarters.has(matches[0][0])) throw new Error("Expected one identified FY2025 PDF link per quarter");
    quarters.set(matches[0][0], value);
  }
  return [4, 3, 2, 1].map(q => quarters.get(String(q))!);
}
