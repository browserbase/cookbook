import { describe, expect, it } from "vitest";

import {
  applyTaskEvent,
  initializeTask,
  recordTaskBrowserContext,
  recordTaskBrowserProxyLocation,
  safeText,
  setTaskBrowserContext,
  type DurableTaskRecord,
} from "../agent/lib/task-state";

const empty = (): DurableTaskRecord => ({
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
});
const event = (type: string, id: string, data: Record<string, unknown> = {}) => ({
  type,
  data,
  meta: { id, at: "2026-09-05T00:00:00.000Z" },
});

describe("durable Eve task state", () => {
  it("restores a versioned task by replaying stable Eve events", () => {
    let state = initializeTask(empty(), "session_fixture", "2026-09-05T00:00:00.000Z");
    state = applyTaskEvent(
      state,
      event("message.received", "evt_user", {
        message: "Research durable agents",
      }),
      "session_fixture",
    );
    state = applyTaskEvent(
      state,
      event("message.completed", "evt_assistant", { message: "Finished." }),
      "session_fixture",
    );
    expect(state).toMatchObject({
      version: 1,
      sessionId: "session_fixture",
      title: "Research durable agents",
    });
    expect(state.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
  });
  it("keeps short follow-ups in the same session and rejects duplicate events", () => {
    let state = applyTaskEvent(
      empty(),
      event("message.received", "evt_one", { message: "Start" }),
      "session_fixture",
    );
    state = applyTaskEvent(
      state,
      event("message.received", "evt_two", { message: "move it back" }),
      "session_fixture",
    );
    state = applyTaskEvent(
      state,
      event("message.received", "evt_two", { message: "move it back" }),
      "session_fixture",
    );
    expect(state.sessionId).toBe("session_fixture");
    expect(state.messages).toHaveLength(2);
  });
  it("survives human waits and resumes the same workflow", () => {
    let state = applyTaskEvent(
      empty(),
      event("input.requested", "evt_wait", { prompt: "Enter OTP code" }),
      "session_fixture",
    );
    expect(state).toMatchObject({
      status: "waiting_for_user",
      waitReason: "otp",
    });
    state = applyTaskEvent(state, event("session.waiting", "evt_parked"), "session_fixture");
    expect(state).toMatchObject({
      status: "waiting_for_user",
      waitReason: "otp",
    });
    state = applyTaskEvent(state, event("input.resolved", "evt_resume"), "session_fixture");
    expect(state).toMatchObject({ status: "running", activeStep: "resuming" });
  });
  it("records loaded skills from Eve action results", () => {
    let state = applyTaskEvent(
      empty(),
      event("action.result", "evt_skill", {
        result: { kind: "load-skill-result", name: "fill-form" },
      }),
      "session_fixture",
    );
    state = applyTaskEvent(
      state,
      event("action.result", "evt_skill_again", {
        result: { kind: "load-skill-result", name: "fill-form" },
      }),
      "session_fixture",
    );
    expect(state.loadedSkillIds).toEqual(["fill-form"]);
  });
  it("keeps a reusable Context while it clears the old browser session", () => {
    const state = setTaskBrowserContext(
      {
        ...empty(),
        browser: {
          lifecycle: "active",
          sessionId: "session_12345678",
          contextId: "context_old_1234",
        },
      },
      "context_new_1234",
      "closed",
    );
    expect(state.browser).toMatchObject({
      contextId: "context_new_1234",
      lifecycle: "closed",
    });
    expect(state.browser.sessionId).toBeUndefined();
  });
  it("records a draft Context without closing the active browser", () => {
    const state = recordTaskBrowserContext(
      {
        ...empty(),
        browser: {
          lifecycle: "active",
          sessionId: "session_12345678",
        },
      },
      "context_draft_1234",
      "draft",
    );
    expect(state.browser).toMatchObject({
      contextId: "context_draft_1234",
      contextStatus: "draft",
      lifecycle: "active",
      sessionId: "session_12345678",
    });
  });
  it("keeps the proxy location in durable task state", () => {
    const state = recordTaskBrowserProxyLocation(empty(), {
      country: "US",
      state: "CA",
      city: "San Francisco",
    });
    expect(state.browser.proxyLocation).toEqual({
      country: "US",
      state: "CA",
      city: "San Francisco",
    });
  });
  it("cancels the task and closes its browser without clearing its Context", () => {
    const state = applyTaskEvent(
      {
        ...empty(),
        status: "running",
        browser: {
          lifecycle: "active",
          sessionId: "session_12345678",
          contextId: "context_12345678",
          url: "https://example.com/login",
        },
      },
      event("turn.cancelled", "evt_cancel"),
      "session_fixture",
    );
    expect(state).toMatchObject({
      status: "canceled",
      browser: {
        lifecycle: "closed",
        contextId: "context_12345678",
        url: "https://example.com/login",
      },
    });
    expect(state.browser.sessionId).toBeUndefined();
  });
  it("redacts secrets and signed Browserbase URLs", () => {
    const text = safeText(
      "password=hunter2 otp:123456 https://www.browserbase.com/devtools-fullscreen/x.html?wss=secret",
    );
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("123456");
    expect(text).not.toContain("wss=secret");
  });
});
