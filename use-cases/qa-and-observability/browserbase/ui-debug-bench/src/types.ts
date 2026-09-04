export type InterfaceName = "browse" | "stagehand-act" | "stagehand-cdp";

export type BugCategory =
  | "visual"
  | "functional"
  | "state"
  | "validation"
  | "async"
  | "auth"
  | "mobile"
  | "a11y"
  | "network-failure";

/** target.config.json — everything the harness needs to run one app. */
export interface TargetConfig {
  name: string;
  /** Relative path to the app codebase within the target directory. */
  app: string;
  /** Dependency install command, e.g. "npm ci" or "bun install --frozen-lockfile". */
  install: string;
  /** Dev server command. "{port}" is replaced with an open port. */
  serve: string;
  /** Validation commands run in the workspace after each fix. */
  validate: string[];
  /** Path prefixes the fixer should prioritize, most important first. */
  fixerContext?: string[];
  /** Optional live deployments, bug id -> URL, for hosted (debug-only) mode. */
  hosted?: Record<string, string>;
}

export interface BugSpec {
  id: string;
  title: string;
  category: BugCategory;
  bugReport: string;
  expectedBehavior: string;
  /** Route appended to the dev server URL. Defaults to "/<id>"; "" for single-page fixtures. */
  route: string;
  /** Absolute path to the bug's check.ts. */
  checkPath: string;
  /** Optional repair guidance appended to the repair handoff (repair-hints.md). */
  repairHints?: string;
  hostedUrl?: string;
}

export interface Target {
  name: string;
  dir: string;
  appDir: string;
  config: TargetConfig;
  bugs: BugSpec[];
}

/**
 * The unified check contract — one artifact that is both the oracle and the probe.
 *
 * `expression` is JavaScript evaluated in the page. It must return an object with:
 *   passed: boolean              — did the expected behavior hold?
 *   passCondition: string        — human-readable statement of what passing means
 *   instructionToFixer?: string  — when failing, what the fixer should change
 *   ...measurements              — any named DOM/style/state evidence
 *
 * The harness never shows the check to the debugger, and only shows the check's
 * RESULT to the fixer after a failed attempt.
 */
export interface CheckDefinition {
  viewport?: { width: number; height: number };
  expression: string;
}

export interface CheckResult {
  passed: boolean;
  passCondition: string;
  instructionToFixer?: string;
  [measurement: string]: unknown;
}

export interface CheckReport {
  ok: boolean;
  result?: CheckResult;
  wallClockMs: number;
  error?: string;
}

export interface PrimitiveCall {
  interface: InterfaceName;
  command: string;
  stdout: string;
  stderr: string;
  wallClockMs: number;
  ok: boolean;
}

export interface BrowserEvidence {
  url: string;
  observations: string[];
  console: string[];
  network: string[];
  screenshots: string[];
  primitiveCalls: PrimitiveCall[];
}

export interface StructuredHandoff {
  symptom: string;
  steps: string[];
  evidence: string[];
  hypothesized_cause: string;
}

export interface DebugReport {
  bugId: string;
  interface: InterfaceName;
  structured: StructuredHandoff;
  screenshots: string[];
  evidence: BrowserEvidence;
  tokens: number;
  wallClockMs: number;
}

export interface FixReport {
  success: boolean;
  filesModified: string[];
  contextFiles: string[];
  tokens: number;
  wallClockMs: number;
  notes: string;
}

export interface ValidationReport {
  ok: boolean;
  command: string;
  stdout: string;
  stderr: string;
  wallClockMs: number;
}

export type FeedbackLevel = "full" | "failure-text";

export interface AttemptRecord {
  attempt: number;
  fix: FixReport;
  validation: ValidationReport;
  check: CheckReport;
}

export interface RunRecord {
  id: string;
  target: string;
  bugId: string;
  category: BugCategory;
  mode: "local" | "hosted";
  interface: InterfaceName;
  maxAttempts: number;
  feedback: FeedbackLevel;
  success: boolean;
  first_pass_success: boolean;
  attempts_used: number;
  pre_fix_bug_confirmed: boolean;
  evidence_quality_score?: number;
  files_modified: string[];
  tokens: { debugger: number; fixer: number; judge: number };
  wall_clock_ms: number;
  error?: { message: string; stack?: string };
  artifacts: Record<string, string>;
}
