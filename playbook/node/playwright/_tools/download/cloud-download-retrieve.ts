/** Run using npx tsx playwright/_tools/download/cloud-download-retrieve.ts */

import dotenv from "dotenv";
import { lstatSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import JSZip from "jszip";
dotenv.config();

function ensureDirectory(directory: string): void {
  try {
    mkdirSync(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  if (!lstatSync(directory).isDirectory()) {
    throw new Error("Download destination must be a directory, not a symlink or file");
  }
}

function regularFile(file: JSZip.JSZipObject): boolean {
  if (file.dir) return false;
  const permissions = typeof file.unixPermissions === "string"
    ? Number.parseInt(file.unixPermissions, 8)
    : file.unixPermissions;
  const type = (permissions ?? 0) & 0o170000;
  return type === 0 || type === 0o100000;
}

function safeBasename(file: JSZip.JSZipObject): string {
  const original = file.unsafeOriginalName ?? file.name;
  if (!original || original.startsWith("/") || /[\\:\x00-\x1f\x7f]/.test(original)) {
    throw new Error("ZIP contains an unsafe file path");
  }
  const segments = original.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("ZIP contains an unsafe file path");
  }
  return segments[segments.length - 1]!;
}

export async function main(): Promise<string> {
  const sessionId = process.env.BROWSERBASE_SESSION_ID?.trim();
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!sessionId || sessionId === "<session-id>") {
    throw new Error("Set BROWSERBASE_SESSION_ID to the session whose downloads you want");
  }
  if (!apiKey) throw new Error("Set BROWSERBASE_API_KEY before retrieving downloads");

  const response = await fetch(
    `https://api.browserbase.com/v1/sessions/${encodeURIComponent(sessionId)}/downloads`,
    {
      method: "GET",
      headers: { "X-BB-API-Key": apiKey },
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) throw new Error(`Download request failed with HTTP ${response.status}`);

  const contents = await JSZip.loadAsync(await response.arrayBuffer(), { checkCRC32: true });
  const files = Object.values(contents.files).filter(regularFile);
  if (files.length === 0) throw new Error("Download ZIP contains no regular files");
  const names = files.map(safeBasename);

  // This example saves the first regular file reported by JSZip, flattened to its basename.
  const fileData = await files[0]!.async("nodebuffer");
  const downloadsDirectory = path.resolve("downloads");
  const filesDirectory = path.join(downloadsDirectory, "files");
  ensureDirectory(downloadsDirectory);
  ensureDirectory(filesDirectory);
  const outputPath = path.join(filesDirectory, names[0]!);
  writeFileSync(outputPath, fileData, { flag: "wx", mode: 0o600 });
  console.log(`Saved one downloaded file to: ${outputPath}`);
  return outputPath;
}

main().catch(() => {
  console.error("Download retrieval failed. Check configuration, archive, and output destination.");
  process.exitCode = 1;
});
