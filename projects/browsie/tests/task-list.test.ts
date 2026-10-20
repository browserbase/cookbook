import type { MessageStreamEvent } from "eve/client";
import { describe, expect, it } from "vitest";

import {
  sessionIdsFromRunFiles,
  sortTasksNewestFirst,
  summarizeTask,
} from "../app/api/tasks/route";

const event = (type: string, at: string, data: Record<string, unknown> = {}) =>
  ({
    type,
    data,
    meta: { id: `${type}-${at}`, at, index: 0 },
  }) as unknown as MessageStreamEvent;

describe("durable task list", () => {
  it("selects recent local Eve sessions for development recovery", () => {
    expect(
      sessionIdsFromRunFiles(
        ["wrun_01MOLD.json", "not-a-run.json", "wrun_01MNEW.json", "wrun_01MNEW.txt"],
        2,
      ),
    ).toEqual(["wrun_01MOLD", "wrun_01MNEW"]);
  });

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
    expect(task.updatedAt).toBe("2026-09-05T01:00:01.000Z");
  });

  it("orders tasks by the latest visible message, not a later tool event", () => {
    const task = summarizeTask("session_one", [
      event("message.received", "2026-09-05T01:00:00.000Z", {
        message: "Do the task",
      }),
      event("message.completed", "2026-09-05T01:00:01.000Z", {
        message: "Done",
      }),
      event("action.result", "2026-09-05T01:00:02.000Z"),
    ]);
    expect(task.updatedAt).toBe("2026-09-05T01:00:01.000Z");
  });

  it("keeps parked tasks waiting and sorts newest first", () => {
    const older = summarizeTask("session_old", [
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
