import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Maps `${competitor}:${country}` → Browserbase Context id (a persisted, logged-in
// session). Gitignored: the id grants access to the logged-in session via your API
// key. The actual cookies live in Browserbase's Context store, not in this file.
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CONTEXTS_FILE = path.join(HERE, "..", "..", "contexts.json");

export async function loadContexts(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await fs.readFile(CONTEXTS_FILE, "utf8"));
  } catch {
    return {};
  }
}

export async function saveContext(key: string, id: string): Promise<void> {
  const m = await loadContexts();
  m[key] = id;
  await fs.writeFile(CONTEXTS_FILE, JSON.stringify(m, null, 2));
}

export async function getContext(key: string): Promise<string | undefined> {
  return (await loadContexts())[key];
}
