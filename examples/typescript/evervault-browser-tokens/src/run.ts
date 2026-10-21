import { randomUUID } from "node:crypto";
import { DemoError, safeError } from "./sanitize.js";

export type RunState = {
  runId: string;
  status: "running" | "stopping" | "succeeded" | "failed" | "stopped";
  progress: string;
  cleanupStatus: "pending" | "releasing" | "completed" | "failed";
  displayCardTokens?: { number: string; cvc: string };
  proxiedOutcome?: "approved";
  controlOutcome?: "rejected_as_expected";
  error?: { code: string; message: string };
};
export type RunContext = {
  signal: AbortSignal;
  update(patch: Partial<Omit<RunState, "runId" | "error">>): void;
};
export type RunExecutor = (context: RunContext) => Promise<void>;

// One local comparison, with its result retained until the next starts.
export class CurrentRun {
  private current?: {
    state: RunState;
    abort: AbortController;
    done: Promise<void>;
    finished: boolean;
  };

  start(executor: RunExecutor): RunState {
    if (this.current && !this.current.finished)
      throw new DemoError("RUN_IN_PROGRESS", "A comparison is already active");
    const entry = {
      state: {
        runId: randomUUID(),
        status: "running",
        progress: "Creating tokens",
        cleanupStatus: "pending",
      } as RunState,
      abort: new AbortController(),
      done: Promise.resolve(),
      finished: false,
    };
    this.current = entry;
    entry.done = Promise.resolve()
      .then(() =>
        executor({
          signal: entry.abort.signal,
          update: (patch) => Object.assign(entry.state, patch),
        }),
      )
      .then(() => {
        entry.state.status = entry.abort.signal.aborted ? "stopped" : "succeeded";
      })
      .catch((error) => {
        entry.state.status =
          entry.abort.signal.aborted && entry.state.cleanupStatus === "completed"
            ? "stopped"
            : "failed";
        if (entry.state.status === "failed") entry.state.error = safeError(error);
      })
      .finally(() => {
        if (entry.state.cleanupStatus !== "completed") {
          entry.state.status = "failed";
          entry.state.cleanupStatus = "failed";
          entry.state.error ??= safeError(
            new DemoError(
              "CLEANUP_UNCONFIRMED",
              "Session cleanup could not be confirmed. Check Browserbase before another comparison.",
            ),
          );
        }
        entry.state.displayCardTokens = undefined;
        entry.state.progress = "Finished";
        entry.finished = true;
      });
    return this.get(entry.state.runId)!;
  }

  get(runId: string): RunState | undefined {
    const state = this.current?.state;
    if (state?.runId !== runId) return undefined;
    // Explicit projection: never return provider responses or private resources.
    return structuredClone({
      runId: state.runId,
      status: state.status,
      progress: state.progress,
      cleanupStatus: state.cleanupStatus,
      displayCardTokens: state.displayCardTokens,
      proxiedOutcome: state.proxiedOutcome,
      controlOutcome: state.controlOutcome,
      error: state.error,
    });
  }

  stop(runId: string): RunState | undefined {
    if (this.current?.state.runId !== runId) return undefined;
    if (!this.current.finished) {
      this.current.state.status = "stopping";
      this.current.abort.abort();
    }
    return this.get(runId);
  }

  async settled(runId: string): Promise<void> {
    if (this.current?.state.runId === runId) await this.current.done;
  }

  async shutdown(): Promise<void> {
    if (this.current) {
      this.stop(this.current.state.runId);
      await this.current.done;
    }
  }
}
