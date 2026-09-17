import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig, DEFAULT_LABEL } from "./config.js";
import { makeWorkflowStagehand } from "./stagehand-session.js";
import {
  makeBrowserbase,
  liveViewUrl,
  fetchSessionDownloads,
  getSessionStatus,
} from "./bb.js";
import { loadWorkflow, type LoadedWorkflow } from "./workflow.js";
import { platformForWorkflow, resolveContextId } from "./platforms.js";
import { createBrowserEvalTool } from "./tools/browser-eval.js";
import { tagged } from "./logger.js";
import { runBrowserTask } from "./../browser-task.js";

const SYSTEM_PROMPT =
  "You are a data-migration assistant operating a web portal the user is already logged into. " +
  "Work autonomously and do not ask follow-up questions. Stop once the task is complete.";

// Downloads sync asynchronously; give file-producing workflows time, but don't make
// JSON-extraction workflows (which never download) wait the full minute.
const DOWNLOAD_TIMEOUT_WITH_SCHEMA_MS = 6_000;
const DOWNLOAD_TIMEOUT_DEFAULT_MS = 60_000;

export interface RunResult {
  index: number;
  sessionId: string | null;
  liveViewUrl: string | null;
  success: boolean;
  message: string;
  output?: unknown;
  /** Path to the saved download zip (its unzipped contents land alongside), if any. */
  downloadPath?: string;
  /** Path to the saved structured-output JSON file (typed-output workflows), if any. */
  outputPath?: string;
  /** Wall-clock duration of the run in milliseconds. */
  durationMs?: number;
  /** Number of agent steps (tool-calls) the run took. */
  steps?: number;
  error?: string;
  /** Versioned acceptance decision persisted for stats and retry parity. */
  passed?: boolean;
  acceptanceVersion?: 1;
  requireDeliverable?: boolean;
}

/**
 * Did a run pass?
 *
 * Default: the agent reported success OR it produced a deliverable (file or output JSON).
 * When `requireDeliverable` is set (download/extraction workflows), a deliverable is mandatory —
 * the agent's self-reported success alone does NOT count, so a "success" with no file gets retried.
 */
export function passed(r: RunResult, requireDeliverable = false): boolean {
  const deliverable = !!r.downloadPath || !!r.outputPath;
  return requireDeliverable ? deliverable : r.success === true || deliverable;
}

export interface RunOptions {
  volume: number;
  concurrency?: number;
  /** Label for this batch — segments output into results/<label>/ (e.g. "gemini-3-no-cdp"). */
  label?: string;
  /** Re-run not-passed sessions up to this many extra rounds (overrides workflow.json). */
  retries?: number;
}

/** Loosened view of an AI SDK fullStream part — fields vary by part type. */
interface StreamPart {
  type: string;
  text?: string;
  toolName?: string;
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
  error?: unknown;
}

/** One entry in a persisted session trace. */
interface TraceEvent {
  t: number; // ms since the run started
  type: string;
  toolName?: string;
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
  text?: string;
  error?: string;
}

// Cap individual trace values so a giant CDP payload (e.g. a full AX tree) can't
// bloat the file — keep enough to debug, mark the rest as truncated.
const MAX_TRACE_VALUE_CHARS = 20_000;
function capValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  let str: string;
  try {
    str = JSON.stringify(value);
  } catch {
    str = String(value);
  }
  if (str.length <= MAX_TRACE_VALUE_CHARS) return value;
  return {
    _truncated: true,
    originalLength: str.length,
    preview: str.slice(0, MAX_TRACE_VALUE_CHARS),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** True for Anthropic rate-limit / tokens-per-minute (429) errors that are worth retrying. */
function isRateLimitError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const e = err as {
    statusCode?: number;
    status?: number;
    cause?: { statusCode?: number };
  };
  const status = e?.statusCode ?? e?.status ?? e?.cause?.statusCode;
  return (
    status === 429 ||
    msg.includes("rate limit") ||
    msg.includes("tokens per minute") ||
    msg.includes("exceed your organization")
  );
}

/** Exponential backoff with jitter, capped — tuned for a per-minute token window. */
function rateLimitBackoffMs(attempt: number): number {
  const base = Math.min(60_000, 10_000 * 2 ** (attempt - 1)); // 10s, 20s, 40s, 60s, 60s…
  return base + Math.floor(Math.random() * 5_000); // de-sync concurrent sessions
}

/**
 * Run a single isolated session: open it, navigate, run the streaming agent (with the browserEval
 * tool), capture structured output / retrieve any downloaded file, then tear down.
 */
async function runOne(
  index: number,
  total: number,
  wf: LoadedWorkflow,
  contextId: string,
  resultsDir: string,
): Promise<RunResult> {
  const log = tagged(`${index}/${total}`);
  const bb = makeBrowserbase();
  let sh: Awaited<ReturnType<typeof makeWorkflowStagehand>> | undefined;
  let sessionId: string | null = null;

  // Accumulate a debug trace of the agent's stream for this session.
  const startedAt = Date.now();
  const events: TraceEvent[] = [];
  let liveUrl: string | null = null;
  let usage: unknown;
  let textBuf = "";
  const flushText = () => {
    if (textBuf) {
      events.push({ t: Date.now() - startedAt, type: "text", text: textBuf });
      textBuf = "";
    }
  };

  const persistTrace = async (outcome: {
    success: boolean;
    message?: string;
    error?: string;
    downloadPath?: string;
    outputPath?: string;
    output?: unknown;
    passed?: boolean;
    acceptanceVersion?: 1;
    requireDeliverable?: boolean;
  }) => {
    flushText();
    const fileBase = (sessionId ?? `run-${index}`).slice(0, 8);
    const payload = {
      sessionId,
      workflow: wf.name,
      model: wf.meta.model,
      startUrl: wf.meta.startUrl,
      liveViewUrl: liveUrl,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      steps: events.filter((e) => e.type === "tool-call").length,
      ...outcome,
      usage,
      events,
    };
    try {
      await mkdir(resultsDir, { recursive: true });
      await writeFile(
        join(resultsDir, `${fileBase}.json`),
        JSON.stringify(payload, null, 2),
      );
    } catch (e) {
      log(
        `failed to write trace: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  try {
    sh = await makeWorkflowStagehand({ contextId, model: wf.meta.model });
    sessionId = sh.browser.sessionId ?? null;
    liveUrl = sessionId ? await liveViewUrl(bb, sessionId) : null;
    const short = (sessionId ?? `run-${index}`).slice(0, 8);
    // Start line: one row per session (a block up front under full concurrency).
    console.log(
      `▶ [${index}/${total}] ${short}  ${liveUrl ?? "(no live view)"}`,
    );

    const page = (await sh.browser.context.pages())[0];
    await page.goto(wf.meta.startUrl, { timeout: wf.meta.navTimeoutMs });

    // Run the agent with generous retries on Anthropic rate-limit (429 / tokens-per-minute)
    // errors, which are common when many sessions start at once. The SDK retries 3× internally;
    // this rides out the per-minute window with exponential backoff + jitter on top of that.
    const maxAttempts = wf.meta.agentMaxRetries + 1;
    let outcome:
      { success: boolean; message: string; output?: unknown } | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const agent = (task: Parameters<typeof runBrowserTask>[1]) =>
          runBrowserTask(sh!, task, {
            systemPrompt: SYSTEM_PROMPT,
            tools: {
              browserEval: createBrowserEvalTool(sh!),
              ...(wf.toolFactory
                ? { extractAllNotes: wf.toolFactory(sh!) }
                : {}),
            },
            excludeTools: wf.meta.excludeTools,
          });

        const stream = await agent({
          instruction: wf.prompt,
          maxSteps: wf.meta.maxSteps,
          // Typed structured output only when the workflow declares a schema.ts.
          // Cast at the SDK boundary: execute() types `output` as ZodObject; our loader
          // holds it as ZodTypeAny (always a z.object(...) in practice).
          ...(wf.schema ? { output: wf.schema as never } : {}),
        });

        for (const step of stream.actions) {
          const t = Date.now() - startedAt;
          if (step.text) events.push({ t, type: "text", text: step.text });
          for (const call of step.toolCalls)
            events.push({
              t,
              type: "tool-call",
              toolName: call.toolName,
              toolCallId: call.toolCallId,
              input: capValue(call.input),
            });
          for (const result of step.toolResults)
            events.push({
              t,
              type: "tool-result",
              toolName: result.toolName,
              toolCallId: result.toolCallId,
              output: capValue(result.output),
            });
        }
        const result = stream;
        usage = result.usage;
        outcome = {
          success: result.success,
          message: result.message,
          output: result.output,
        };
        break;
      } catch (e) {
        if (isRateLimitError(e) && attempt < maxAttempts) {
          flushText();
          const waitMs = rateLimitBackoffMs(attempt);
          // Recorded in the trace only — kept off the console to stay quiet.
          events.push({
            t: Date.now() - startedAt,
            type: "rate-limit-retry",
            error: `attempt ${attempt}/${maxAttempts}, waiting ${Math.round(waitMs / 1000)}s`,
          });
          await sleep(waitMs);
          continue;
        }
        throw e; // non-rate-limit, or retries exhausted → fail this session
      }
    }

    if (!outcome) throw new Error("agent did not produce a result");

    // Retrieve any downloaded file BEFORE closing — the session must stay open while
    // Browserbase finishes syncing the download to storage.
    let downloadPath: string | undefined;
    if (sessionId) {
      const timeoutMs = wf.schema
        ? DOWNLOAD_TIMEOUT_WITH_SCHEMA_MS
        : DOWNLOAD_TIMEOUT_DEFAULT_MS;
      const saved = await fetchSessionDownloads(bb, sessionId, join(resultsDir, sessionId), {
        timeoutMs,
        fileBase: sessionId.slice(0, 8),
      });
      if (saved) downloadPath = saved;
    }

    // Typed-output workflows: write the structured result as its own deliverable file
    // (<short>.output.json) next to the trace, so the data isn't only buried in the trace.
    let outputPath: string | undefined;
    if (
      outcome.output &&
      typeof outcome.output === "object" &&
      Object.keys(outcome.output).length
    ) {
      await mkdir(resultsDir, { recursive: true });
      const attemptDir = join(resultsDir, sessionId ?? `run-${index}`);
      await mkdir(attemptDir, { recursive: true });
      outputPath = join(attemptDir, "output.json");
      await writeFile(outputPath, JSON.stringify(outcome.output, null, 2));
    }

    const resultForAcceptance: RunResult = {
      index, sessionId, liveViewUrl: liveUrl, success: outcome.success,
      message: outcome.message, output: outcome.output, downloadPath, outputPath,
    };
    const passVerdict = passed(resultForAcceptance, !!wf.meta.requireDeliverable);
    await persistTrace({
      success: outcome.success,
      message: outcome.message,
      downloadPath,
      outputPath,
      output: outcome.output,
      passed: passVerdict,
      acceptanceVersion: 1,
      requireDeliverable: !!wf.meta.requireDeliverable,
    });

    const durationMs = Date.now() - startedAt;
    const deliverable = downloadPath ? "file" : outputPath ? "json" : "—";
    // Finish line: one row per session as it completes.
    console.log(
      `${outcome.success ? "✓" : "✗"} [${index}/${total}] ${short}  ${(durationMs / 1000).toFixed(1)}s  ${deliverable}`,
    );

    return {
      index,
      sessionId,
      liveViewUrl: liveUrl,
      success: outcome.success,
      message: outcome.message,
      output: outcome.output,
      downloadPath,
      outputPath,
      durationMs,
      steps: events.filter((e) => e.type === "tool-call").length,
      passed: passVerdict,
      acceptanceVersion: 1,
      requireDeliverable: !!wf.meta.requireDeliverable,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await persistTrace({
      success: false,
      error: message,
      passed: false,
      acceptanceVersion: 1,
      requireDeliverable: !!wf.meta.requireDeliverable,
    });
    const durationMs = Date.now() - startedAt;
    const short = (sessionId ?? `run-${index}`).slice(0, 8);
    console.log(
      `✗ [${index}/${total}] ${short}  ${(durationMs / 1000).toFixed(1)}s  error`,
    );
    return {
      index,
      sessionId,
      liveViewUrl: liveUrl,
      success: false,
      message: "",
      error: message,
      durationMs,
      steps: events.filter((e) => e.type === "tool-call").length,
    };
  } finally {
    if (sh) {
      // Guard close with a timeout so a hung teardown can't stall the batch.
      await Promise.race([
        sh.close().catch(() => {}),
        new Promise((r) => setTimeout(r, 10_000)),
      ]);
    }
  }
}

/** Bounded-concurrency map: never more than `limit` tasks in flight at once. */
async function pool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}

/**
 * Final summary table, verified against the Browserbase APIs: status + server-measured
 * duration from sessions.retrieve, and file presence from the download captured during the run.
 */
async function printFinalTable(
  bb: ReturnType<typeof makeBrowserbase>,
  results: RunResult[],
  requireDeliverable = false,
): Promise<void> {
  const rows = await Promise.all(
    results.map(async (r) => {
      const s = r.sessionId
        ? await getSessionStatus(bb, r.sessionId)
        : { status: null, serverDurationMs: null };
      const durMs = s.serverDurationMs ?? r.durationMs ?? null;
      // A "deliverable" is either a downloaded file (zip) or a structured-output JSON.
      const hasOutput = !!r.downloadPath || !!r.outputPath;
      return {
        short: (r.sessionId ?? `run-${r.index}`).slice(0, 8),
        dur: durMs != null ? `${(durMs / 1000).toFixed(1)}s` : "—",
        status: r.error
          ? "ERROR"
          : (s.status ?? (r.success ? "COMPLETED" : "—")),
        kind: r.downloadPath ? "file" : r.outputPath ? "json" : "—",
        success: r.success,
        hasOutput,
      };
    }),
  );

  const withOutput = rows.filter((r) => r.hasOutput);
  const noOutput = rows.filter((r) => !r.hasOutput);

  console.log(
    "\n──────────────────────────── Final summary ────────────────────────────",
  );
  console.log(
    `  ${"SESSION".padEnd(9)}  ${"DURATION".padStart(9)}  ${"STATUS".padEnd(10)}  OUTPUT`,
  );
  console.log("  " + "─".repeat(42));
  for (const row of rows) {
    console.log(
      `  ${row.short.padEnd(9)}  ${row.dur.padStart(9)}  ${row.status.padEnd(10)}  ${row.kind}`,
    );
  }

  console.log(
    `\n  Output (${withOutput.length}):    ${withOutput.map((r) => r.short).join(", ") || "none"}`,
  );
  console.log(
    `  No output (${noOutput.length}): ${noOutput.map((r) => r.short).join(", ") || "none"}`,
  );

  // "passed" = agent success OR a deliverable (file/structured output) — unless requireDeliverable,
  // in which case the deliverable is mandatory (a bare self-reported success does NOT count).
  const passedCount = rows.filter((r) =>
    requireDeliverable ? r.hasOutput : r.success || r.hasOutput,
  ).length;
  console.log(
    `\n  ${rows.length} sessions  ·  ${passedCount} passed  ·  ${withOutput.length} produced output  ·  ${noOutput.length} none`,
  );
}

/**
 * Run a workflow at the requested volume. Fans out concurrent sessions (full volume by
 * default; pass --concurrency to throttle), each reusing the saved login context read-only,
 * runs the streaming CDP agent, retrieves any downloaded file, and writes a per-session
 * <short-session-id>.json trace into the workflow's own results/ folder. One session failing
 * does not abort the batch.
 */
export async function runWorkflow(
  name: string,
  opts: RunOptions,
): Promise<RunResult[]> {
  loadConfig({ requireModelKey: true });
  const wf = await loadWorkflow(name);

  // Each site has its own saved context (so e.g. Platform B auth never collides with Platform A's).
  const platform = platformForWorkflow(name);
  const contextId = resolveContextId(platform);
  if (!contextId) {
    throw new Error(
      `No saved ${platform.label} context (${platform.contextEnv} not set in .env).\n` +
        `Run \`npm run portal-login:${platform.key}\` first to log in and save it.`,
    );
  }

  // Default to running the whole batch concurrently; pass --concurrency to throttle.
  const limit = opts.concurrency ?? opts.volume;

  // Per-workflow results live alongside the workflow definition; session ids key each file.
  // Folder precedence: --label (CLI) > resultsLabel (workflow.json) > DEFAULT_LABEL. The folder is
  // created if missing and appended to if it exists (session ids keep files unique).
  const label = (opts.label ?? wf.meta.resultsLabel ?? DEFAULT_LABEL).replace(
    /[^A-Za-z0-9._-]/g,
    "-",
  );
  const resultsDir = join(wf.dir, "results", label);

  console.log(
    `\nRunning "${name}"  ·  ${opts.volume} session(s)  ·  model ${wf.meta.model}` +
      (label ? `  ·  label ${label}` : "") +
      (limit !== opts.volume ? `  ·  concurrency ${limit}` : ""),
  );
  console.log(
    `Results → ${resultsDir}/  (<id>.json trace · <id>.zip download)\n`,
  );

  const indexes = Array.from({ length: opts.volume }, (_, i) => i + 1);
  const results = await pool(indexes, limit, (i) =>
    runOne(i, opts.volume, wf, contextId, resultsDir),
  );

  // Fail-fast + retry: re-run any not-passed session (fresh session) up to N rounds. With a tight
  // maxSteps, stuck runs already failed quickly; a retry usually recovers the flaky/looped few.
  // For download/extraction workflows, "not-passed" means "no file" — a self-reported success with
  // no deliverable is treated as a failure and retried (see passed() + meta.requireDeliverable).
  const reqDeliverable = wf.meta.requireDeliverable ?? false;
  const maxRounds = opts.retries ?? wf.meta.failureRetries;
  const failedInitially = new Set(
    results.filter((r) => !passed(r, reqDeliverable)).map((r) => r.index),
  );
  for (let round = 1; round <= maxRounds; round++) {
    const toRetry = results
      .map((r, pos) => ({ r, pos }))
      .filter((x) => !passed(x.r, reqDeliverable));
    if (toRetry.length === 0) break;
    console.log(
      `\nretry round ${round}/${maxRounds}: re-running ${toRetry.length} of ${results.length}…`,
    );
    const retried = await pool(toRetry, limit, (item) =>
      runOne(item.r.index, opts.volume, wf, contextId, resultsDir),
    );
    retried.forEach((res, k) => {
      results[toRetry[k].pos] = res;
    });
  }
  const recovered = results.filter(
    (r) => failedInitially.has(r.index) && passed(r, reqDeliverable),
  ).length;

  await printFinalTable(makeBrowserbase(), results, reqDeliverable);
  if (failedInitially.size > 0) {
    console.log(
      `  retries: ${recovered}/${failedInitially.size} initially-failed sessions recovered`,
    );
  }
  return results;
}
