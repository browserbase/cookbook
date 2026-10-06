import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { consoleMessageFromCdpEvent } from "../server/browserbase-console.js";
import { ContextMetadataStore } from "../server/context-metadata.js";
import {
  browserbaseSessionOptions,
  consoleMessageFromStagehandEvent,
  ContextStudioService,
  deleteBrowserbaseContext,
  validateStartUrl,
  type ContextStudioGateway,
} from "../server/context-studio.js";
import {
  challengeAfterTimeout,
  challengeFromConsole,
  isBrowserbaseDisconnectMessage,
} from "../src/context-studio.js";

function fixtureGateway(): ContextStudioGateway & {
  listener?: (message: string) => void;
  released: string[];
  events: string[];
  sessionStatuses: Array<"RUNNING" | "COMPLETED">;
} {
  const contexts = new Map([["context_fixture", { id: "context_fixture", name: "Fixture login" }]]);
  return {
    released: [],
    events: [],
    sessionStatuses: ["RUNNING", "COMPLETED"],
    async createContext(name) {
      const value = { id: "context_created", name };
      contexts.set(value.id, value);
      return value;
    },
    async retrieveContext(id) {
      const value = contexts.get(id);
      if (!value) throw new Error("missing");
      return value;
    },
    async deleteContext(id) {
      contexts.delete(id);
    },
    async createSession() {
      return { id: "session_fixture" };
    },
    async retrieveSession() {
      return { status: this.sessionStatuses.shift() ?? "COMPLETED" };
    },
    async releaseSession(id) {
      this.released.push(id);
    },
    async navigateSession(_id, url) {
      this.events.push("navigate:" + url);
    },
    async liveView() {
      return "https://www.browserbase.com/devtools-fullscreen/inspector.html?wss=fixture&navbar=false";
    },
    async attachConsole(_id, listener) {
      this.events.push("attach-console");
      this.listener = listener;
      return async () => undefined;
    },
  };
}

async function serviceFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "browsie-context-test-"));
  const metadata = new ContextMetadataStore(path.join(directory, "contexts.json"));
  await metadata.add("context_fixture", "Local fixture");
  const gateway = fixtureGateway();
  const service = new ContextStudioService(gateway, metadata, async () => undefined);
  return { gateway, metadata, service };
}

describe("Context Studio state", () => {
  it("keeps drafts hidden until the same Context is promoted", async () => {
    const { metadata, service } = await serviceFixture();
    const now = new Date("2026-09-18T00:00:00.000Z");
    await metadata.addDraft(
      "context_draft",
      "Browsie draft fixture",
      "session_fixture",
      new Date("2026-09-25T00:00:00.000Z"),
      now,
    );
    expect((await service.listContexts()).some((context) => context.id === "context_draft")).toBe(
      false,
    );

    await metadata.promote("context_draft", "Hacker News", now);
    const state = await metadata.read();
    expect(state.contexts.context_draft).toMatchObject({
      name: "Hacker News",
      status: "saved",
    });
    expect(state.contexts.context_draft.ownerSessionId).toBeUndefined();
    expect(state.contexts.context_draft.expiresAt).toBeUndefined();
    expect(state.selectedContextId).toBe("context_draft");
  });

  it("creates, names, selects, lists, and deletes known Browserbase Contexts", async () => {
    const { service } = await serviceFixture();
    await service.createContext("Work email");
    let contexts = await service.listContexts();
    expect(contexts.map((context) => context.name)).toContain("Work email");
    await service.selectContext("context_fixture");
    contexts = await service.listContexts();
    expect(contexts.find((context) => context.id === "context_fixture")?.selected).toBe(true);
    await service.deleteContext("context_created");
    expect((await service.listContexts()).some((context) => context.id === "context_created")).toBe(
      false,
    );
  });

  it("enforces one active writer and completes close before Context sync success", async () => {
    const { gateway, service } = await serviceFixture();
    const session = await service.startSession(
      "context_fixture",
      "login",
      "https://accounts.example.com/login",
    );
    expect(service.getSession(session.sessionId)?.status).toBe("live");
    await expect(
      service.startSession("context_fixture", "test", "https://accounts.example.com/"),
    ).rejects.toThrow("active writer");
    service.finishSession(session.sessionId);
    await vi.waitFor(() => expect(service.getSession(session.sessionId)?.status).toBe("saved"));
    expect(gateway.released).toEqual(["session_fixture"]);
    expect(gateway.events.slice(0, 2)).toEqual([
      "attach-console",
      "navigate:https://accounts.example.com/login",
    ]);
  });

  it("uses persistent verified proxied sessions with CAPTCHA solving", () => {
    expect(browserbaseSessionOptions("context_fixture", "login")).toMatchObject({
      keepAlive: true,
      proxies: true,
      browserSettings: {
        context: { id: "context_fixture", persist: true },
        verified: true,
        solveCaptchas: true,
      },
    });
  });

  it("deletes Contexts without the SDK empty-JSON request defect", async () => {
    const requests: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ input: String(input), init });
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    await deleteBrowserbaseContext("test-key", "context_fixture", fetcher);
    expect(requests).toHaveLength(1);
    expect(requests[0].init?.method).toBe("DELETE");
    expect(requests[0].init?.body).toBeUndefined();
    expect(new Headers(requests[0].init?.headers).has("content-type")).toBe(false);
  });

  it("accepts only HTTPS destinations without embedded credentials", () => {
    expect(validateStartUrl("https://accounts.example.com/login#step")).toBe(
      "https://accounts.example.com/login",
    );
    expect(() => validateStartUrl("http://accounts.example.com")).toThrow("HTTPS");
    expect(() => validateStartUrl("https://user:secret@accounts.example.com")).toThrow(
      "without embedded credentials",
    );
    expect(() => validateStartUrl("not a URL")).toThrow("valid HTTPS");
  });
});

describe("CAPTCHA challenge transitions", () => {
  it("does not treat the started signal as terminal", () => {
    const started = challengeFromConsole(
      { status: "idle" },
      "browserbase-solving-started",
      new Date("2026-01-01T00:00:00Z"),
    );
    expect(started.status).toBe("solving_captcha");
    const finished = challengeFromConsole(
      started,
      "browserbase-solving-finished",
      new Date("2026-01-01T00:00:10Z"),
    );
    expect(finished.status).toBe("captcha_solved");
  });

  it("moves solver errors to the interactive fallback", () => {
    const started = challengeFromConsole(
      { status: "idle" },
      "browserbase-solving-started",
      new Date("2026-01-01T00:00:00Z"),
    );
    expect(
      challengeFromConsole(started, "browserbase-solving-errored", new Date("2026-01-01T00:00:02Z"))
        .status,
    ).toBe("captcha_error");
  });

  it("keeps an interactive fallback after the application timeout", () => {
    const started = challengeFromConsole({ status: "idle" }, "browserbase-solving-started");
    expect(challengeAfterTimeout(started).status).toBe("captcha_timeout");
  });

  it("reads typed Stagehand v4 CDP console events", () => {
    expect(
      consoleMessageFromStagehandEvent({
        params: {
          args: [{ type: "string", value: "browserbase-solving-started" }],
        },
      }),
    ).toBe("browserbase-solving-started");
  });

  it("reads Browserbase CAPTCHA signals from the session-boundary CDP adapter", () => {
    expect(
      consoleMessageFromCdpEvent({
        method: "Runtime.consoleAPICalled",
        params: {
          args: [{ type: "string", value: "browserbase-solving-finished" }],
        },
      }),
    ).toBe("browserbase-solving-finished");
    expect(
      consoleMessageFromCdpEvent({
        method: "Runtime.executionContextCreated",
        params: {},
      }),
    ).toBeUndefined();
  });
});

describe("Live View disconnect events", () => {
  it("recognizes only the documented Browserbase message", () => {
    expect(isBrowserbaseDisconnectMessage("browserbase-disconnected")).toBe(true);
    expect(isBrowserbaseDisconnectMessage("disconnected")).toBe(false);
  });
});
