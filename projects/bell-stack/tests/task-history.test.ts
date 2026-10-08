import { describe, expect, it } from "vitest";

import { parseTaskHistory, taskTitle, upsertTaskHistory } from "../src/task-history";

describe("task history", () => {
  it("rejects invalid stored data", () => {
    expect(parseTaskHistory("not json")).toEqual([]);
    expect(parseTaskHistory(JSON.stringify([{ sessionId: "a" }]))).toEqual([]);
  });

  it("keeps the latest value for one session", () => {
    const older = {
      sessionId: "one",
      title: "Old",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const newer = {
      sessionId: "one",
      title: "New",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    expect(upsertTaskHistory([older], newer)).toEqual([newer]);
  });

  it("sorts and limits tasks", () => {
    const first = {
      sessionId: "one",
      title: "One",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const second = {
      sessionId: "two",
      title: "Two",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    expect(upsertTaskHistory([first], second, 1)).toEqual([second]);
  });

  it("makes a short title from the first request", () => {
    expect(taskTitle("  Find   a cafe  ")).toBe("Find a cafe");
    expect(taskTitle("a".repeat(80))).toHaveLength(50);
  });
});
