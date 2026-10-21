import { randomUUID } from "node:crypto";
import { DemoError, safeError } from "./sanitize.js";

export type RunStatus =
  "starting" | "running" | "holding" | "succeeded" | "failed" | "stopping" | "stopped";
export type AwaitingAction = "enter_token" | "submit_token";
export type GateResult = "advanced" | "stopped" | "timed_out";
export type RunState = {
  runId: string;
  status: RunStatus;
  events: Array<{ at: string; step: string; detail: string }>;
  awaitingAction?: AwaitingAction;
  cleanupStatus: "pending" | "releasing" | "completed" | "failed";
  displayCardTokens?: { number: string; cvc: string };
  proxiedLiveViewUrl?: string;
  controlLiveViewUrl?: string;
  proxiedOutcome?: "approved";
  controlOutcome?: "rejected_as_expected";
  error?: { code: string; message: string };
};

export type RunContext = {
  readonly runId: string;
  readonly signal: AbortSignal;
  update(patch: Partial<Omit<RunState, "runId" | "events">>): void;
  event(step: string, detail: string): void;
  setStopHook(hook: () => Promise<void>): void;
  isStopRequested(): boolean;
  wait(milliseconds: number): Promise<void>;
  waitForAdvance(action: AwaitingAction, timeoutMs: number): Promise<GateResult>;
};
export type RunExecutor = (context: RunContext) => Promise<void>;
type Entry = {
  state: RunState;
  abort: AbortController;
  stopHook?: () => Promise<void>;
  gate?: { action: AwaitingAction; finish(result: GateResult): void };
  done: Promise<void>;
  finishedAt?: number;
};

// This projection is the only local API boundary. Never add SDK responses here.
function project(state: RunState): RunState {
  return structuredClone({
    runId: state.runId,
    status: state.status,
    events: state.events,
    cleanupStatus: state.cleanupStatus,
    awaitingAction: state.awaitingAction,
    displayCardTokens: state.displayCardTokens,
    proxiedLiveViewUrl: state.proxiedLiveViewUrl,
    controlLiveViewUrl: state.controlLiveViewUrl,
    proxiedOutcome: state.proxiedOutcome,
    controlOutcome: state.controlOutcome,
    error: state.error,
  });
}

export class RunStore {
  private readonly runs = new Map<string, Entry>();
  private activeRunId?: string;

  private prune() {
    for (const [id, entry] of this.runs) {
      if (entry.finishedAt && Date.now() - entry.finishedAt > 600_000) this.runs.delete(id);
    }
  }

  start(executor: RunExecutor): RunState {
    this.prune();
    if (this.activeRunId) throw new DemoError("RUN_IN_PROGRESS", "A comparison is already active");
    const runId = randomUUID();
    const entry: Entry = {
      state: { runId, status: "starting", events: [], cleanupStatus: "pending" },
      abort: new AbortController(),
      done: Promise.resolve(),
    };
    this.runs.set(runId, entry);
    this.activeRunId = runId;
    const context: RunContext = {
      runId,
      signal: entry.abort.signal,
      update: (patch) => {
        Object.assign(entry.state, patch);
      },
      event: (step, detail) => {
        entry.state.events.push({ at: new Date().toISOString(), step, detail });
        entry.state.events = entry.state.events.slice(-100);
      },
      setStopHook: (hook) => {
        entry.stopHook = hook;
      },
      isStopRequested: () => entry.abort.signal.aborted,
      wait: (milliseconds) =>
        new Promise<void>((resolve) => {
          if (entry.abort.signal.aborted) return resolve();
          const finish = () => {
            clearTimeout(timer);
            entry.abort.signal.removeEventListener("abort", finish);
            resolve();
          };
          const timer = setTimeout(finish, milliseconds);
          entry.abort.signal.addEventListener("abort", finish, { once: true });
        }),
      waitForAdvance: (action, timeoutMs) =>
        new Promise<GateResult>((resolve) => {
          if (entry.abort.signal.aborted) return resolve("stopped");
          if (entry.gate) throw new DemoError("RUN_GATE_ACTIVE", "A checkpoint is already active");
          entry.state.awaitingAction = action;
          const timer = setTimeout(() => finish("timed_out"), timeoutMs);
          const onAbort = () => finish("stopped");
          const finish = (result: GateResult) => {
            clearTimeout(timer);
            entry.abort.signal.removeEventListener("abort", onAbort);
            entry.gate = undefined;
            entry.state.awaitingAction = undefined;
            resolve(result);
          };
          entry.gate = { action, finish };
          entry.abort.signal.addEventListener("abort", onAbort, { once: true });
        }),
    };
    entry.done = Promise.resolve()
      .then(() => executor(context))
      .then(() => {
        if (entry.state.cleanupStatus === "failed") entry.state.status = "failed";
        else
          entry.state.status =
            entry.abort.signal.aborted || entry.state.status === "stopped"
              ? "stopped"
              : "succeeded";
      })
      .catch((error: unknown) => {
        // A failed cleanup must remain visible even after the user requested Stop.
        entry.state.status =
          entry.abort.signal.aborted && entry.state.cleanupStatus === "completed"
            ? "stopped"
            : "failed";
        if (entry.state.status === "failed") entry.state.error = safeError(error);
      })
      .finally(() => {
        entry.gate?.finish("stopped");
        entry.state.displayCardTokens = undefined;
        entry.state.proxiedLiveViewUrl = undefined;
        entry.state.controlLiveViewUrl = undefined;
        entry.stopHook = undefined;
        entry.finishedAt = Date.now();
        this.activeRunId = undefined;
      });
    return project(entry.state);
  }

  get(runId: string): RunState | undefined {
    this.prune();
    const entry = this.runs.get(runId);
    return entry ? project(entry.state) : undefined;
  }

  advance(runId: string, action: AwaitingAction): RunState | undefined {
    const entry = this.runs.get(runId);
    if (!entry) return undefined;
    if (entry.abort.signal.aborted || entry.gate?.action !== action) {
      throw new DemoError("RUN_NOT_READY", "That action is not available at this checkpoint");
    }
    entry.gate.finish("advanced");
    return project(entry.state);
  }

  async stop(runId: string): Promise<RunState | undefined> {
    const entry = this.runs.get(runId);
    if (!entry) return undefined;
    if (!entry.finishedAt && !entry.abort.signal.aborted) {
      entry.state.status = "stopping";
      entry.abort.abort();
      await entry.stopHook?.().catch(() => undefined);
    }
    return project(entry.state);
  }

  async settled(runId: string): Promise<void> {
    await this.runs.get(runId)?.done;
  }

  async shutdown(): Promise<void> {
    const id = this.activeRunId;
    if (id) {
      await this.stop(id);
      await this.settled(id);
    }
  }
}
