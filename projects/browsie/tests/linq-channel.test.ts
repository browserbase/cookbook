import { afterEach, describe, expect, it, vi } from "vitest";

import linq, { isAllowedLinqSender, requiredEnvironmentValue } from "../agent/channels/linq";
import { applyTaskEvent, type DurableTaskRecord } from "../agent/lib/task-state";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Linq channel", () => {
  it("steers an active turn when a new message arrives", () => {
    expect(linq.turnPolicy).toBe("steer");
  });

  it("mounts the native Eve Linq webhook route", () => {
    expect(linq.routes.map(({ method, path }) => ({ method, path }))).toEqual([
      { method: "GET", path: "/eve/v1/linq" },
      { method: "POST", path: "/eve/v1/linq" },
    ]);
  });

  it("rejects bot messages", () => {
    expect(isAllowedLinqSender({ isBot: true, userId: "linq:user_123" })).toBe(false);
  });

  it("accepts people when no sender allowlist is configured", () => {
    expect(isAllowedLinqSender({ isBot: false, userId: "linq:user_123" }, undefined)).toBe(true);
  });

  it("uses exact sender identifiers in a trimmed allowlist", () => {
    const sender = { isBot: false, userId: "linq:user_123" };

    expect(isAllowedLinqSender(sender, "linq:user_other,  linq:user_123  ")).toBe(true);
    expect(isAllowedLinqSender(sender, "user_123")).toBe(false);
  });

  it("loads and trims channel credentials from the environment", () => {
    vi.stubEnv("LINQ_API_KEY", "  linq_test_key  ");

    expect(requiredEnvironmentValue("LINQ_API_KEY")).toBe("linq_test_key");
  });

  it("fails clearly when a channel credential is missing", () => {
    vi.stubEnv("LINQ_WEBHOOK_SECRET", "");

    expect(() => requiredEnvironmentValue("LINQ_WEBHOOK_SECRET")).toThrow(
      "LINQ_WEBHOOK_SECRET is required for the Linq channel.",
    );
  });

  it("keeps a steered follow-up in the same durable task", () => {
    let task = emptyTask();
    task = applyTaskEvent(
      task,
      linqEvent("message.received", "message_one", {
        message: "Open Hacker News",
      }),
      "linq_conversation_session",
    );
    task = applyTaskEvent(task, linqEvent("turn.started", "turn_one"), "linq_conversation_session");
    task = applyTaskEvent(
      task,
      linqEvent("turn.cancelled", "turn_one_cancelled"),
      "linq_conversation_session",
    );
    task = applyTaskEvent(
      task,
      linqEvent("message.received", "message_two", {
        message: "Stop that and open Example.com",
      }),
      "linq_conversation_session",
    );
    task = applyTaskEvent(task, linqEvent("turn.started", "turn_two"), "linq_conversation_session");

    expect(task).toMatchObject({
      sessionId: "linq_conversation_session",
      status: "running",
    });
    expect(task.messages.map(({ text }) => text)).toEqual([
      "Open Hacker News",
      "Stop that and open Example.com",
    ]);
  });
});

function emptyTask(): DurableTaskRecord {
  return {
    version: 1,
    taskId: "",
    sessionId: "",
    title: "New task",
    messages: [],
    status: "idle",
    browser: { lifecycle: "not_started" },
    loadedSkillIds: [],
    artifacts: [],
    traceEventIds: [],
    processedEventIds: [],
    createdAt: "",
    updatedAt: "",
  };
}

function linqEvent(type: string, id: string, data: Record<string, unknown> = {}) {
  return {
    type,
    data,
    meta: { id, at: "2026-09-18T20:00:00.000Z" },
  };
}
