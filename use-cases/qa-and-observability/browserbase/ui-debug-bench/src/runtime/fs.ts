import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { createHash, randomUUID } from "node:crypto";

export async function readText(path: string): Promise<string> {
  return readFile(path, "utf8");
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function copyIsolatedWorkspace(appPath: string): Promise<string> {
  const dir = join(tmpdir(), `ui-debug-bench-${basename(appPath)}-${randomUUID()}`);
  await rm(dir, { recursive: true, force: true });
  await cp(appPath, dir, {
    recursive: true,
    filter: (src) => !src.includes("node_modules") && !src.includes(".git") && !src.endsWith("/dist")
  });
  return dir;
}

export async function listFiles(root: string, exts = [".ts", ".tsx", ".js", ".jsx", ".css", ".html", ".json", ".md"]): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (exts.some((ext) => entry.name.endsWith(ext))) {
        out.push(relative(root, full));
      }
    }
  }
  await walk(root);
  return out.sort();
}

export async function fileExists(path: string): Promise<boolean> {
  return stat(path).then(() => true, () => false);
}

export async function hashWorkspace(root: string): Promise<Map<string, string>> {
  const files = await listFiles(root);
  const hashes = new Map<string, string>();
  for (const file of files) {
    const body = await readFile(join(root, file));
    hashes.set(file, createHash("sha256").update(body).digest("hex"));
  }
  return hashes;
}

export function diffHashes(before: Map<string, string>, after: Map<string, string>): string[] {
  const changed = new Set<string>();
  for (const [file, hash] of after) {
    if (before.get(file) !== hash) changed.add(file);
  }
  for (const file of before.keys()) {
    if (!after.has(file)) changed.add(file);
  }
  return Array.from(changed).sort();
}
