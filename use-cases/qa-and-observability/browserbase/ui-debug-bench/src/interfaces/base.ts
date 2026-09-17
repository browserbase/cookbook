import type { BrowserEvidence } from "../types.js";

/**
 * A browser interface: how the debugger drives a browser to gather evidence.
 *
 * `repro` is an async builder that turns (bug report, initial page snapshot)
 * into a page-side JS expression reproducing the bug. The default builder asks
 * the LLM; interfaces should skip the reproduction step if it returns undefined.
 */
export interface BrowserInterface {
  name: "browse" | "stagehand-act" | "stagehand-cdp";
  inspect(input: {
    url: string;
    bugReport: string;
    artifactDir: string;
    repro: (bugReport: string, snapshot: string) => Promise<string | undefined>;
  }): Promise<BrowserEvidence>;
}

export function wantsMobileViewport(bugReport: string): boolean {
  return /\bmobile\b|\bphone\b|375|small screen/i.test(bugReport);
}
