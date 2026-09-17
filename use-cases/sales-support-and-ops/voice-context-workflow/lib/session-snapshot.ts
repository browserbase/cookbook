import { z } from "zod";
import type { DemoSessionSnapshot } from "./demo-types";

const nullableText = z.string().nullable();
const snapshotSchema = z.object({
  demoId: z.string(), activeRunId: nullableText,
  status: z.enum(["idle", "starting", "planning", "acting", "answering", "ready", "incomplete", "blocked", "error"]),
  busy: z.boolean(), liveViewUrl: nullableText, browserbaseSessionId: nullableText,
  claudeSessionId: nullableText, currentUrl: nullableText, pageTitle: nullableText,
  lastInstruction: nullableText, lastSummary: nullableText, currentStep: nullableText,
  lastNarration: nullableText,
  lastControlOutcome: z.enum(["accepted", "running", "duplicate_ignored", "queued", "interrupting", "completed", "incomplete", "blocked", "error"]).nullable(),
  lastControlMessage: nullableText, queuedInstructionCount: z.number().int().nonnegative(),
  queuedInstructions: z.array(z.string()), stepCount: z.number().int().nonnegative(),
  error: nullableText, missingConfig: z.array(z.string()),
  events: z.array(z.object({
    id: z.string(), kind: z.enum(["system", "user", "assistant", "tool", "browser", "error"]),
    message: z.string(), createdAt: z.string(), runId: nullableText.optional(),
    speakable: nullableText.optional(), step: z.number().optional(),
  })),
});

export function parseSessionSnapshot(value: unknown, demoId: string): DemoSessionSnapshot {
  const snapshot = snapshotSchema.parse(value);
  if (snapshot.demoId !== demoId) throw new Error("Snapshot belongs to a different demo.");
  return snapshot;
}
