import type { MessageStreamEvent } from "eve/client";
import { describe, expect, it } from "vitest";

import { sortTasksNewestFirst, summarizeTask } from "../app/api/tasks/route";

const event = (type: string, at: string, data: Record<string, unknown> = {}) =>
  ({
    type,
    data,
    meta: { id: `${type}-${at}`, at, index: 0 },
  }) as unknown as MessageStreamEvent;

describe("durable task list", () => {
  it("uses the first user message as a bounded title", () => {
    const task = summarizeTask("session_one", [
      event("message.received", "2026-09-05T01:00:00.000Z", {
        message: "  First   durable task  ",
      }),
      event("message.received", "2026-09-05T01:00:01.000Z", {
        message: "follow up",
      }),
    ]);
    expect(task.title).toBe("First durable task");
    expect(task.hasUserMessage).toBe(true);
    expect(task.updatedAt).toBe("2026-09-05T01:00:01.000Z");
  });

  it("marks a session without a user message as empty", () => {
    const task = summarizeTask("session_empty", [
      event("session.started", "2026-09-05T01:00:00.000Z"),
    ]);

    expect(task.title).toBe("Untitled task");
    expect(task.hasUserMessage).toBe(false);
  });

  it("keeps parked tasks waiting and sorts newest first", () => {
    const older = summarizeTask("session_old", [
      event("message.received", "2026-09-05T00:59:59.000Z", { message: "Wait for login" }),
      event("input.requested", "2026-09-05T01:00:00.000Z"),
      event("session.waiting", "2026-09-05T01:00:01.000Z"),
    ]);
    const newer = {
      ...older,
      sessionId: "session_new",
      updatedAt: "2026-09-05T02:00:00.000Z",
    };
    expect(older.state).toBe("waiting_for_user");
    expect(sortTasksNewestFirst([older, newer]).map((task) => task.sessionId)).toEqual([
      "session_new",
      "session_old",
    ]);
  });
});
