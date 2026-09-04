import { randomUUID } from "node:crypto";
import type { WorkflowResult, WorkflowState } from "./types.js";

export type RunSnapshot = WorkflowState & {
  runId: string | null;
  revision: number;
  isRunning: boolean;
};

const failureMessage = "Run failed.";
const now = () => new Date().toISOString();

/** Latest-run state only. A terminal callback does not release the cleanup lock. */
export class RunStateStore {
  private current: RunSnapshot = {
    runId: null,
    revision: 0,
    isRunning: false,
    stage: "idle",
    message: "Ready to start a test.",
    timestamp: now(),
  };
  private terminalCallback = false;

  snapshot(): RunSnapshot {
    return structuredClone(this.current);
  }

  begin(): string {
    if (this.current.isRunning) throw new Error("A run is already in progress.");
    const runId = randomUUID();
    this.current = {
      runId,
      revision: this.current.revision + 1,
      isRunning: true,
      stage: "initializing",
      message: "Starting test.",
      timestamp: now(),
    };
    this.terminalCallback = false;
    return runId;
  }

  update(runId: string, state: WorkflowState): void {
    if (!this.accepts(runId) || this.terminalCallback) return;
    const metadata = this.mergedMetadata(state.metadata);
    if (state.stage === "error") metadata.error = failureMessage;
    this.current = {
      ...this.current,
      stage: state.stage,
      message: state.stage === "error" ? failureMessage : state.message,
      timestamp: state.timestamp,
      metadata,
      revision: this.current.revision + 1,
    };
    this.terminalCallback = state.stage === "completed" || state.stage === "error";
  }

  finish(runId: string, result: WorkflowResult): void {
    if (!this.accepts(runId)) return;
    const saved: WorkflowResult = structuredClone(result);
    // A cleanup or operation failure must not discard an already captured test result.
    if (saved.taskPreview === undefined && this.current.metadata?.result?.taskPreview !== undefined) {
      saved.taskPreview = structuredClone(this.current.metadata.result.taskPreview);
    }
    if (!saved.success || saved.error !== undefined) saved.error = failureMessage;
    const status = saved.taskPreview?.status;
    const testMessage = status === "PASSED" || status === "FAILED" ? `Test ${status}.` : "Run completed.";
    const metadata = this.mergedMetadata({ result: saved });
    if (!saved.success) metadata.error = failureMessage;
    this.current = {
      ...this.current,
      stage: saved.success ? "completed" : "error",
      message: saved.success ? testMessage : failureMessage,
      timestamp: now(),
      isRunning: false,
      metadata,
      revision: this.current.revision + 1,
    };
  }

  fail(runId: string): void {
    if (!this.accepts(runId)) return;
    this.finish(runId, { success: false, error: failureMessage, timestamp: now() });
  }

  private accepts(runId: string): boolean {
    return this.current.isRunning && this.current.runId === runId;
  }

  private mergedMetadata(incoming?: WorkflowState["metadata"]): NonNullable<WorkflowState["metadata"]> {
    const metadata = structuredClone(this.current.metadata ?? {});
    for (const [key, value] of Object.entries(incoming ?? {})) {
      if (value !== undefined) {
        Object.defineProperty(metadata, key, { value: structuredClone(value), enumerable: true, configurable: true, writable: true });
      }
    }
    if (metadata.error !== undefined) metadata.error = failureMessage;
    if (metadata.result && typeof metadata.result === "object" && metadata.result.error !== undefined) {
      metadata.result.error = failureMessage;
    }
    return metadata;
  }
}
