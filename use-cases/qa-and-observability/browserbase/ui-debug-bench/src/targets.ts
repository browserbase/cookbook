import { readdir } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import type { BugCategory, BugSpec, Target, TargetConfig } from "./types.js";
import { fileExists, readText } from "./runtime/fs.js";

/** Load a single target from a directory containing target.config.json + bugs/. */
export async function loadTarget(dir: string): Promise<Target> {
  const targetDir = resolve(dir);
  const configPath = join(targetDir, "target.config.json");
  if (!(await fileExists(configPath))) {
    throw new Error(`No target.config.json in ${targetDir}`);
  }
  const config = JSON.parse(await readText(configPath)) as TargetConfig;
  const appDir = join(targetDir, config.app);
  const bugsDir = join(targetDir, "bugs");
  const bugs: BugSpec[] = [];
  if (await fileExists(bugsDir)) {
    for (const entry of (await readdir(bugsDir, { withFileTypes: true })).filter((e) => e.isDirectory())) {
      bugs.push(await loadBug(join(bugsDir, entry.name), entry.name, config));
    }
  }
  return { name: config.name, dir: targetDir, appDir, config, bugs: bugs.sort((a, b) => a.id.localeCompare(b.id)) };
}

/** Load every target one level under a suite directory (e.g. targets/bench). */
export async function loadSuite(dir: string): Promise<Target[]> {
  const suiteDir = resolve(dir);
  if (await fileExists(join(suiteDir, "target.config.json"))) {
    return [await loadTarget(suiteDir)];
  }
  const targets: Target[] = [];
  for (const entry of (await readdir(suiteDir, { withFileTypes: true })).filter((e) => e.isDirectory())) {
    const candidate = join(suiteDir, entry.name);
    if (await fileExists(join(candidate, "target.config.json"))) {
      targets.push(await loadTarget(candidate));
    }
  }
  if (targets.length === 0) throw new Error(`No targets found under ${suiteDir}`);
  return targets.sort((a, b) => a.name.localeCompare(b.name));
}

async function loadBug(bugDir: string, id: string, config: TargetConfig): Promise<BugSpec> {
  const bugMd = await readText(join(bugDir, "bug.md"));
  const parsed = parseBugMd(bugMd, id);
  const checkPath = join(bugDir, "check.ts");
  if (!(await fileExists(checkPath))) {
    throw new Error(`Bug ${id} is missing check.ts (${checkPath}). Every bug needs a check.`);
  }
  const hintsPath = join(bugDir, "repair-hints.md");
  const repairHints = (await fileExists(hintsPath)) ? (await readText(hintsPath)).trim() : undefined;
  return {
    id,
    title: parsed.title,
    category: parsed.category,
    bugReport: parsed.report,
    expectedBehavior: parsed.expected,
    route: parsed.route ?? `/${id}`,
    checkPath: isAbsolute(checkPath) ? checkPath : resolve(checkPath),
    repairHints,
    hostedUrl: config.hosted?.[id]
  };
}

/**
 * bug.md format:
 *   # Title
 *   Category: functional
 *   Route: /some-path        (optional; "Route: /" for single-page fixtures)
 *   User report: ...
 *   Expected behavior: ...
 */
function parseBugMd(text: string, id: string): { title: string; category: BugCategory; report: string; expected: string; route?: string } {
  const title = /^#\s+(.+)$/m.exec(text)?.[1]?.trim();
  const category = field(text, "Category") as BugCategory | undefined;
  const route = field(text, "Route");
  const report = field(text, "User report");
  const expected = field(text, "Expected behavior");
  if (!title || !category || !report || !expected) {
    throw new Error(`bug.md for ${id} must include a # title, Category:, User report:, and Expected behavior:`);
  }
  return { title, category, report, expected, route: route === "/" ? "" : route };
}

function field(text: string, name: string): string | undefined {
  const match = new RegExp(`^${name}:\\s*([\\s\\S]+?)(?=\\n\\s*\\n|\\n[A-Z][a-z]+(?: [a-z]+)?:|$)`, "m").exec(text);
  return match?.[1]?.replace(/\s+/g, " ").trim();
}
