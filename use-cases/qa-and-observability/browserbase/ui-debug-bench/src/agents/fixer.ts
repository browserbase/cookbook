import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import type { DebugReport, FixReport } from "../types.js";
import type { LlmClient } from "./llm.js";
import { extractJson } from "./llm.js";
import { listFiles, readText } from "../runtime/fs.js";

interface FixPayload {
  notes: string;
  files: Array<{ path: string; content: string }>;
}

/**
 * Code fixer: reads the workspace and the debugger handoff, writes a
 * localized patch. Context prioritization is configured per target
 * (fixerContext path prefixes, most important first).
 */
export async function runFixer(input: {
  workspace: string;
  debugReport: DebugReport;
  contextPriority: string[];
  llm: LlmClient;
}): Promise<FixReport> {
  const start = Date.now();
  const files = await listFiles(input.workspace);
  const sourceFiles = selectContextFiles(files, input.contextPriority);
  const bundle = await Promise.all(
    sourceFiles.map(async (file) => `--- ${file}\n${await readText(join(input.workspace, file))}`)
  );
  const prompt = [
    "Fix the app with a localized change. Prefer touching 1-2 files.",
    "Debugger handoff (JSON):",
    JSON.stringify(input.debugReport.structured, null, 2),
    "Repository files:",
    bundle.join("\n\n"),
    'Return JSON: {"notes":"...","files":[{"path":"relative/path","content":"full replacement file"}]}.'
  ].join("\n\n");
  const llm = await input.llm.complete({
    system: "You are a code fixer. Use only repository contents and browser evidence. Apply the smallest credible fix.",
    prompt,
    maxTokens: 16000
  });
  let payload: FixPayload;
  try {
    payload = extractJson<FixPayload>(llm.text);
  } catch {
    return {
      success: false,
      filesModified: [],
      contextFiles: sourceFiles,
      tokens: llm.tokens,
      wallClockMs: Date.now() - start,
      notes: "Fixer did not return parseable JSON. No files were modified."
    };
  }
  const modified: string[] = [];
  for (const file of (payload.files ?? []).slice(0, 3)) {
    if (file.path.includes("..") || file.path.startsWith("/")) {
      throw new Error(`Refusing unsafe write path from fixer: ${file.path}`);
    }
    await writeFile(join(input.workspace, file.path), file.content);
    modified.push(file.path);
  }
  return {
    success: modified.length > 0,
    filesModified: modified,
    contextFiles: sourceFiles,
    tokens: llm.tokens,
    wallClockMs: Date.now() - start,
    notes: payload.notes ?? ""
  };
}

export function selectContextFiles(files: string[], priority: string[]): string[] {
  const allowedTopLevel = new Set(["index.html", "package.json", "tsconfig.json", "vite.config.ts"]);
  const prefixes = priority.length > 0 ? priority : ["src/"];
  return files
    .filter((file) => {
      if (file.endsWith(".md") || file.endsWith("package-lock.json") || file.endsWith("bun.lock")) return false;
      return prefixes.some((p) => file.startsWith(p)) || allowedTopLevel.has(file);
    })
    .sort((a, b) => rank(a, prefixes) - rank(b, prefixes) || a.localeCompare(b))
    .slice(0, 40);
}

// Most specific (longest) matching prefix wins, so a target can demote noisy
// directories by listing them late: ["src/", "src/components/ui/"] ranks the
// ui kit last even though "src/" also matches.
function rank(file: string, prefixes: string[]): number {
  let best = -1;
  let bestLength = -1;
  prefixes.forEach((p, index) => {
    if (file.startsWith(p) && p.length > bestLength) {
      best = index;
      bestLength = p.length;
    }
  });
  return best === -1 ? prefixes.length : best;
}
