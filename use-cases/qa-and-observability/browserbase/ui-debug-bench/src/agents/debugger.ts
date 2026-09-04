import type { BugSpec, DebugReport, StructuredHandoff } from "../types.js";
import type { BrowserInterface } from "../interfaces/base.js";
import type { LlmClient } from "./llm.js";
import { extractJson } from "./llm.js";
import { makeReproBuilder } from "./repro.js";

/**
 * Browser-only debugger: reproduces the bug in a browser and produces a
 * structured handoff for the fixer. It never sees source code or the check.
 */
export async function runDebugger(input: {
  bug: BugSpec;
  iface: BrowserInterface;
  url: string;
  artifactDir: string;
  llm: LlmClient;
}): Promise<DebugReport> {
  const start = Date.now();
  const evidence = await input.iface.inspect({
    url: input.url,
    bugReport: input.bug.bugReport,
    artifactDir: input.artifactDir,
    repro: makeReproBuilder(input.llm)
  });
  const prompt = [
    `Bug report: ${input.bug.bugReport}`,
    `URL: ${input.url}`,
    "Browser evidence:",
    JSON.stringify(evidence, null, 2),
    "Return JSON with keys: symptom, steps, evidence, hypothesized_cause. Ground the report in the bug report and browser evidence only. Do not mention source files, hidden tests, or benchmark pass criteria because you cannot see them."
  ].join("\n\n");
  const llm = await input.llm.complete({
    system: "You are a browser-only debugger. Reproduce user-visible bugs and hand precise evidence to a code fixer.",
    prompt,
    maxTokens: 4000
  });
  let structured: StructuredHandoff;
  try {
    structured = normalize(extractJson<Partial<StructuredHandoff>>(llm.text), input.bug.bugReport);
  } catch {
    structured = {
      symptom: input.bug.bugReport,
      steps: ["Open the app", "Try to reproduce the reported behavior"],
      evidence: evidence.observations.concat(evidence.console, evidence.network).filter(Boolean).slice(0, 8),
      hypothesized_cause: "Debugger could not produce parseable JSON."
    };
  }
  return {
    bugId: input.bug.id,
    interface: input.iface.name,
    structured,
    screenshots: evidence.screenshots,
    evidence,
    tokens: llm.tokens,
    wallClockMs: Date.now() - start
  };
}

function normalize(report: Partial<StructuredHandoff>, fallbackSymptom: string): StructuredHandoff {
  return {
    symptom: typeof report.symptom === "string" && report.symptom.trim() ? report.symptom : fallbackSymptom,
    steps: stringList(report.steps),
    evidence: stringList(report.evidence),
    hypothesized_cause: typeof report.hypothesized_cause === "string" && report.hypothesized_cause.trim()
      ? report.hypothesized_cause
      : "The browser evidence did not include a clear implementation-level cause."
  };
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(stringify).filter(Boolean);
  const rendered = stringify(value);
  return rendered ? [rendered] : [];
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  return JSON.stringify(value);
}
