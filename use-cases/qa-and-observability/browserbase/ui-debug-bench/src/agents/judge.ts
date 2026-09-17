import type { DebugReport } from "../types.js";
import type { LlmClient } from "./llm.js";
import { extractJson } from "./llm.js";

/**
 * Optional research instrumentation (--score-evidence): rates debugger handoff
 * quality 1-5, independent of whether the fix succeeds. Not part of the loop.
 */
export async function scoreEvidence(input: { report: DebugReport; llm: LlmClient }): Promise<{ score: number; tokens: number }> {
  const result = await input.llm.complete({
    system: "You judge browser debugging reports independent of whether the code fix succeeds.",
    prompt: [
      "Rate the report sufficiency for a code fixer on a 1-5 scale.",
      "Criteria: reproduction specificity, user-visible evidence, console/network clues, no unsupported source-code claims.",
      JSON.stringify(input.report.structured, null, 2),
      'Return JSON: {"score": number}.'
    ].join("\n\n"),
    maxTokens: 1000
  });
  try {
    const parsed = extractJson<{ score: number }>(result.text);
    return { score: Math.max(1, Math.min(5, parsed.score)), tokens: result.tokens };
  } catch {
    return { score: 1, tokens: result.tokens };
  }
}
