import type { LlmClient } from "./llm.js";

/**
 * Ask the LLM to write a source-blind reproduction probe from the bug report
 * and the initial accessibility snapshot. This replaces hardcoded keyword
 * heuristics — the model decides what to click/fill/wait for, so the harness
 * generalizes to apps it has never seen.
 *
 * Returns undefined when the LLM is unavailable or returns something unusable;
 * interfaces then skip the reproduction step gracefully.
 */
export function makeReproBuilder(llm: LlmClient): (bugReport: string, snapshot: string) => Promise<string | undefined> {
  return async (bugReport, snapshot) => {
    const result = await llm.complete({
      system: [
        "You write browser-side reproduction probes. Output a single JavaScript expression — an async IIFE of the form (async () => { ... })() — that runs in the page to reproduce a reported bug and capture evidence.",
        "Rules:",
        "- Interact only with what a user can see: querySelector on visible controls, dispatch input/change events, click buttons, wait with setTimeout promises.",
        "- To set input values reliably in React apps, use the native value setter: Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value), then dispatch an input event with bubbles: true.",
        "- Return a JSON-serializable object of named measurements showing the before/after state relevant to the report (visible text, element presence, computed styles, counts).",
        "- Never throw: use optional chaining and fallbacks so the expression always returns the object.",
        "- Output ONLY the expression. No prose, no markdown fences."
      ].join("\n"),
      prompt: [
        `Bug report: ${bugReport}`,
        "Accessibility snapshot of the page:",
        snapshot.slice(0, 6000),
        "Write the reproduction probe expression."
      ].join("\n\n"),
      maxTokens: 2000
    });
    const expression = stripFences(result.text).trim();
    if (!expression.startsWith("(")) return undefined;
    return expression;
  };
}

function stripFences(text: string): string {
  const fenced = /```(?:javascript|js)?\s*([\s\S]*?)```/.exec(text);
  return fenced?.[1] ?? text;
}
