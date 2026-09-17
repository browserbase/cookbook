import { join } from "node:path";
import { mkdir, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type {
  AttemptRecord,
  BugSpec,
  CheckReport,
  DebugReport,
  FeedbackLevel,
  FixReport,
  InterfaceName,
  RunRecord,
  Target
} from "./types.js";
import { loadCheck, runCheck } from "./check.js";
import { createInterface } from "./interfaces/index.js";
import { runDebugger } from "./agents/debugger.js";
import { runFixer } from "./agents/fixer.js";
import { scoreEvidence } from "./agents/judge.js";
import { ClaudeClient } from "./agents/llm.js";
import { copyIsolatedWorkspace, diffHashes, hashWorkspace, writeJson } from "./runtime/fs.js";
import { installDependencies } from "./runtime/install.js";
import { startDevServer, type DevServer } from "./runtime/server.js";
import { findOpenPort } from "./runtime/ports.js";
import { validateWorkspace } from "./runtime/validate.js";
import { withBrowserbaseSession } from "./runtime/browserbase-session.js";

export interface LoopOptions {
  iface: InterfaceName;
  maxAttempts: number;
  feedback: FeedbackLevel;
  scoreEvidence: boolean;
  browserbase: boolean;
  resultsDir: string;
}

/**
 * THE loop: debug -> fix -> check -> (feed the check result back -> fix -> check) x N.
 *
 * One strategy, two ablation knobs:
 *   maxAttempts = 1            -> "one-shot"
 *   feedback = "failure-text"  -> repair loop without the probe payload
 *   feedback = "full" (default) -> exact-probe strategy: the check's full result
 *                                  (measurements + passCondition + instructionToFixer)
 *                                  becomes the fixer's evidence.
 *
 * Deliberate simplification vs the original prototype: NO second debugger
 * browse during repair. The check result IS the targeted re-browse.
 */
export async function runBugEval(target: Target, bug: BugSpec, opts: LoopOptions): Promise<RunRecord> {
  const id = `${bug.id}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const resultDir = join(opts.resultsDir, id);
  await mkdir(resultDir, { recursive: true });
  const llm = new ClaudeClient();
  const check = await loadCheck(bug.checkPath);
  const started = Date.now();
  const artifacts: Record<string, string> = { result_dir: resultDir };
  let server: DevServer | undefined;
  let workspace: string | undefined;

  const inBrowser = <T>(fn: () => Promise<T>): Promise<T> =>
    opts.browserbase ? withBrowserbaseSession(() => fn()) : fn();

  try {
    workspace = await copyIsolatedWorkspace(target.appDir);
    artifacts.workspace = workspace;
    const install = await installDependencies(workspace, target.config.install);
    await writeJson(join(resultDir, "install-report.json"), install);
    if (!install.ok) throw new Error(`Install failed: ${install.stderr || install.stdout}`);

    const baseline = await hashWorkspace(workspace);
    server = await startDevServer(workspace, target.config.serve, await findOpenPort());
    const url = `${server.url}${bug.route}`;

    // 1. Confirm the planted bug: the check must FAIL before any fix.
    const preCheck = await inBrowser(() => runCheck({ check, url }));
    artifacts.pre_check = join(resultDir, "pre-check.json");
    await writeJson(artifacts.pre_check, preCheck);

    // 2. Browser-only debugger produces the initial handoff.
    const debug = await inBrowser(() => runDebugger({ bug, iface: createInterface(opts.iface), url, artifactDir: resultDir, llm }));
    artifacts.debugger_report = join(resultDir, "debugger-report.json");
    await writeJson(artifacts.debugger_report, debug);
    const judge = opts.scoreEvidence ? await scoreEvidence({ report: debug, llm }) : undefined;

    // 3. Fix until the check passes.
    const attempts: AttemptRecord[] = [];
    let handoff = debug;
    let fixerTokens = 0;
    let success = false;
    for (let attempt = 1; attempt <= opts.maxAttempts; attempt += 1) {
      const before = await hashWorkspace(workspace);
      const fix = await runFixer({
        workspace,
        debugReport: handoff,
        contextPriority: target.config.fixerContext ?? [],
        llm
      });
      fix.filesModified = diffHashes(before, await hashWorkspace(workspace));
      fixerTokens += fix.tokens;

      const validation = await validateWorkspace(workspace, target.config.validate);

      await server.stop();
      server = await startDevServer(workspace, target.config.serve, await findOpenPort());
      const checkReport = validation.ok
        ? await inBrowser(() => runCheck({ check, url: `${server!.url}${bug.route}` }))
        : { ok: false, wallClockMs: 0, error: "Skipped: validation failed." };

      attempts.push({ attempt, fix, validation, check: checkReport });
      await writeJson(join(resultDir, `attempt-${attempt}.json`), attempts[attempts.length - 1]);

      if (validation.ok && checkReport.ok) {
        success = true;
        break;
      }
      if (attempt < opts.maxAttempts) {
        handoff = buildRepairHandoff({ bug, debug, fix, validation, check: checkReport, feedback: opts.feedback });
        await writeJson(join(resultDir, `repair-handoff-${attempt}.json`), handoff.structured);
      }
    }

    const filesModified = diffHashes(baseline, await hashWorkspace(workspace));
    artifacts.attempts = join(resultDir, "attempts.json");
    await writeJson(artifacts.attempts, attempts);

    return {
      id,
      target: target.name,
      bugId: bug.id,
      category: bug.category,
      mode: "local",
      interface: opts.iface,
      maxAttempts: opts.maxAttempts,
      feedback: opts.feedback,
      success,
      first_pass_success: attempts[0] ? attempts[0].validation.ok && attempts[0].check.ok : false,
      attempts_used: attempts.length,
      pre_fix_bug_confirmed: !preCheck.ok,
      evidence_quality_score: judge?.score,
      files_modified: filesModified,
      tokens: { debugger: debug.tokens, fixer: fixerTokens, judge: judge?.tokens ?? 0 },
      wall_clock_ms: Date.now() - started,
      artifacts
    };
  } catch (error) {
    const failure = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };
    await writeJson(join(resultDir, "error-report.json"), failure);
    return {
      id,
      target: target.name,
      bugId: bug.id,
      category: bug.category,
      mode: "local",
      interface: opts.iface,
      maxAttempts: opts.maxAttempts,
      feedback: opts.feedback,
      success: false,
      first_pass_success: false,
      attempts_used: 0,
      pre_fix_bug_confirmed: false,
      files_modified: [],
      tokens: { debugger: 0, fixer: 0, judge: 0 },
      wall_clock_ms: Date.now() - started,
      error: failure,
      artifacts
    };
  } finally {
    await server?.stop();
    if (workspace && process.env.KEEP_WORKSPACES !== "1") {
      await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

/**
 * Hosted mode: debugger + check against a live URL, no fixing.
 * Useful for validating checks, comparing interfaces, demos, and
 * Browserbase-parallel evidence collection.
 */
export async function runHostedEval(target: Target, bug: BugSpec, opts: LoopOptions): Promise<RunRecord> {
  if (!bug.hostedUrl) throw new Error(`Bug ${bug.id} has no hosted URL in target.config.json`);
  const id = `${bug.id}-hosted-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const resultDir = join(opts.resultsDir, id);
  await mkdir(resultDir, { recursive: true });
  const llm = new ClaudeClient();
  const check = await loadCheck(bug.checkPath);
  const started = Date.now();
  const artifacts: Record<string, string> = { result_dir: resultDir };

  const inBrowser = <T>(fn: () => Promise<T>): Promise<T> =>
    opts.browserbase ? withBrowserbaseSession(() => fn()) : fn();

  try {
    const checkReport = await inBrowser(() => runCheck({ check, url: bug.hostedUrl! }));
    artifacts.pre_check = join(resultDir, "pre-check.json");
    await writeJson(artifacts.pre_check, checkReport);

    const debug = await inBrowser(() => runDebugger({ bug, iface: createInterface(opts.iface), url: bug.hostedUrl!, artifactDir: resultDir, llm }));
    artifacts.debugger_report = join(resultDir, "debugger-report.json");
    await writeJson(artifacts.debugger_report, debug);
    const judge = opts.scoreEvidence ? await scoreEvidence({ report: debug, llm }) : undefined;

    return {
      id,
      target: target.name,
      bugId: bug.id,
      category: bug.category,
      mode: "hosted",
      interface: opts.iface,
      maxAttempts: 0,
      feedback: opts.feedback,
      success: false,
      first_pass_success: false,
      attempts_used: 0,
      pre_fix_bug_confirmed: !checkReport.ok,
      evidence_quality_score: judge?.score,
      files_modified: [],
      tokens: { debugger: debug.tokens, fixer: 0, judge: judge?.tokens ?? 0 },
      wall_clock_ms: Date.now() - started,
      artifacts
    };
  } catch (error) {
    const failure = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };
    await writeJson(join(resultDir, "error-report.json"), failure);
    return {
      id,
      target: target.name,
      bugId: bug.id,
      category: bug.category,
      mode: "hosted",
      interface: opts.iface,
      maxAttempts: 0,
      feedback: opts.feedback,
      success: false,
      first_pass_success: false,
      attempts_used: 0,
      pre_fix_bug_confirmed: false,
      files_modified: [],
      tokens: { debugger: 0, fixer: 0, judge: 0 },
      wall_clock_ms: Date.now() - started,
      error: failure,
      artifacts
    };
  }
}

/**
 * Build the repair handoff. The check's failed result is the centerpiece:
 * it names the exact failing element/state, the pass condition, and what to
 * change. No re-browse — sharper assertions beat more browsing.
 */
function buildRepairHandoff(input: {
  bug: BugSpec;
  debug: DebugReport;
  fix: FixReport;
  validation: { ok: boolean; stdout: string; stderr: string };
  check: CheckReport;
  feedback: FeedbackLevel;
}): DebugReport {
  const checkEvidence = input.check.error
    ? `Post-fix check errored: ${input.check.error}`
    : input.feedback === "full"
      ? `Post-fix check result (exact DOM/state probe): ${JSON.stringify(input.check.result, null, 2)}`
      : `Post-fix check failed: ${input.check.result?.passCondition ?? "the expected behavior did not hold"}`;
  const evidence = [
    ...input.debug.structured.evidence,
    `Previous patch notes: ${input.fix.notes}`,
    `Previous patch files: ${input.fix.filesModified.join(", ") || "none"}`,
    ...(input.validation.ok ? [] : [`Build failed after the previous patch: ${input.validation.stderr || input.validation.stdout}`]),
    checkEvidence,
    ...(input.bug.repairHints ? [`Repair hints: ${input.bug.repairHints}`] : [])
  ];
  return {
    ...input.debug,
    structured: {
      symptom: input.bug.bugReport,
      steps: [
        ...input.debug.structured.steps,
        "A previous patch was applied but the user-visible check still fails.",
        "Use the exact check result below to revise the existing localized fix."
      ],
      evidence,
      hypothesized_cause: [
        "The previous code patch did not satisfy the user-visible check.",
        `Expected behavior: ${input.bug.expectedBehavior}`,
        checkEvidence,
        "Revise the smallest relevant code path. Do not broaden the patch beyond the reported behavior."
      ].join(" ")
    }
  };
}
