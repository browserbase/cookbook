import { pathToFileURL } from "node:url";
import type { CheckDefinition, CheckReport, CheckResult } from "./types.js";
import { StagehandHarness } from "./interfaces/stagehand-common.js";

export async function loadCheck(checkPath: string): Promise<CheckDefinition> {
  const mod = await import(pathToFileURL(checkPath).href) as { default?: CheckDefinition };
  const def = mod.default;
  if (!def || typeof def.expression !== "string") {
    throw new Error(`${checkPath} must default-export { viewport?, expression }`);
  }
  return def;
}

/**
 * Run a bug's check against a live URL.
 *
 * The check is the unified oracle + probe: a single page-side expression that
 * returns { passed, passCondition, instructionToFixer?, ...measurements }.
 * The harness reads `passed` to gate success; on failure the whole result
 * object becomes the fixer's evidence.
 */
export async function runCheck(input: { check: CheckDefinition; url: string }): Promise<CheckReport> {
  const start = Date.now();
  const browser = new StagehandHarness("stagehand-cdp");
  try {
    await browser.init();
    await browser.goto(input.url);
    if (input.check.viewport) {
      await browser.setViewportSize(input.check.viewport.width, input.check.viewport.height);
    }
    const raw = await browser.evaluate<unknown>(input.check.expression);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)
      || !("passed" in raw) || typeof raw.passed !== "boolean"
      || !("passCondition" in raw) || typeof raw.passCondition !== "string"
      || ("instructionToFixer" in raw && typeof raw.instructionToFixer !== "string")) {
      return {
        ok: false,
        wallClockMs: Date.now() - start,
        error: "Invalid check result: expected an object with boolean passed, string passCondition, and optional string instructionToFixer"
      };
    }
    const result: CheckResult = { ...raw, passed: raw.passed, passCondition: raw.passCondition };
    return { ok: result.passed, result, wallClockMs: Date.now() - start };
  } catch (error) {
    return {
      ok: false,
      wallClockMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    await browser.close();
  }
}
