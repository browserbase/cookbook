import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { redactValue } from "./redact.js";
import type { ConversationState, TraceEvent, TraceKind } from "./types.js";

export function addTrace(
  state: ConversationState,
  kind: TraceKind,
  name: string,
  summary: string,
  detail?: unknown,
  durationMs?: number,
  code?: string,
): TraceEvent {
  const event = redactValue({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    kind,
    name,
    summary,
    detail,
    code,
    durationMs,
  });
  state.traces.push(event);
  return event;
}

export async function saveTrace(root: string, state: ConversationState): Promise<void> {
  const runDir = path.join(root, "runs");
  await mkdir(runDir, { recursive: true });
  const safe = redactValue({
    conversationId: state.id,
    browser: { ...state.browser, screenshotDataUrl: undefined },
    traces: state.traces,
  });
  await writeFile(path.join(runDir, `${state.id}.json`), `${JSON.stringify(safe, null, 2)}\n`);
}
