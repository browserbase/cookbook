export type ContextSessionPurpose = "login" | "test";

export type ChallengeState =
  | { status: "idle" }
  | { status: "solving_captcha"; startedAt: string }
  | { status: "captcha_timeout"; startedAt: string; timedOutAt: string }
  | { status: "captcha_error"; startedAt: string; erroredAt: string }
  | { status: "captcha_solved"; startedAt: string; finishedAt: string };

export type ContextSessionStatus =
  "starting" | "live" | "closing" | "syncing" | "saved" | "disconnected" | "error";

export interface ContextRecord {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  selected: boolean;
  writerActive: boolean;
}

export interface ContextSessionView {
  sessionId: string;
  contextId: string;
  purpose: ContextSessionPurpose;
  status: ContextSessionStatus;
  challenge: ChallengeState;
  message?: string;
}

export const CAPTCHA_TIMEOUT_MS = 30_000;
export const CONTEXT_SYNC_WAIT_MS = 5_000;

export function challengeFromConsole(
  current: ChallengeState,
  message: string,
  now = new Date(),
): ChallengeState {
  if (message === "browserbase-solving-started") {
    return { status: "solving_captcha", startedAt: now.toISOString() };
  }
  if (message === "browserbase-solving-finished" && current.status === "solving_captcha") {
    return {
      status: "captcha_solved",
      startedAt: current.startedAt,
      finishedAt: now.toISOString(),
    };
  }
  if (message === "browserbase-solving-errored" && current.status === "solving_captcha") {
    return {
      status: "captcha_error",
      startedAt: current.startedAt,
      erroredAt: now.toISOString(),
    };
  }
  return current;
}

export function challengeAfterTimeout(current: ChallengeState, now = new Date()): ChallengeState {
  if (current.status !== "solving_captcha") return current;
  return {
    status: "captcha_timeout",
    startedAt: current.startedAt,
    timedOutAt: now.toISOString(),
  };
}

export function isBrowserbaseDisconnectMessage(value: unknown): boolean {
  return value === "browserbase-disconnected";
}
