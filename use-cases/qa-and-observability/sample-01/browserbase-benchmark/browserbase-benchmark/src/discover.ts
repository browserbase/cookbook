/**
 * Auto-discovery for scenarios and competitors.
 *
 * Scans dist/scenarios/ and dist/competitors/ for compiled .js modules and
 * dynamically imports them. Each module must export a `scenario` or
 * `competitor` named export conforming to the respective interface.
 *
 * Discovery only works on compiled output — run `npm run build` first.
 */

import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import type { Scenario, Competitor } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadModules<T extends { name: string }>(
  subdir: string,
  exportKey: string,
  filter?: string[],
): Promise<T[]> {
  const dir = join(__dirname, subdir);
  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith(".js") && !f.endsWith(".d.js"))
      .sort();
  } catch {
    throw new Error(
      `Directory not found: ${dir}\n` +
      `Did you run "npm run build"? Expected ${subdir}/ inside the dist/ output directory.`,
    );
  }

  const results: T[] = [];
  for (const file of files) {
    let mod: Record<string, unknown>;
    try {
      mod = (await import(pathToFileURL(join(dir, file)).href)) as Record<string, unknown>;
    } catch (err) {
      console.warn(`[discover] Failed to import ${file}: ${err}. Skipping.`);
      continue;
    }

    if (!(exportKey in mod)) {
      console.warn(`[discover] ${file} has no "${exportKey}" export — skipping.`);
      continue;
    }

    const item = mod[exportKey] as T;
    if (filter && filter.length > 0 && !filter.includes(item.name)) continue;
    results.push(item);
  }

  if (results.length === 0) {
    const filterMsg = filter && filter.length > 0 ? ` matching [${filter.join(", ")}]` : "";
    throw new Error(`No ${exportKey}s found in ${dir}${filterMsg}`);
  }

  return results;
}

/** Discover all scenarios in src/scenarios/, optionally filtered by name. */
export async function discoverScenarios(filter?: string[]): Promise<Scenario[]> {
  return loadModules<Scenario>("scenarios", "scenario", filter);
}

/** Discover all competitors in src/competitors/, optionally filtered by name. */
export async function discoverCompetitors(filter?: string[]): Promise<Competitor[]> {
  return loadModules<Competitor>("competitors", "competitor", filter);
}
