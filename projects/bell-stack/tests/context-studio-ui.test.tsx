// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ContextStudio from "../src/ContextStudio";
import type { ContextSessionView } from "../src/context-studio";

let sessions: Map<string, ContextSessionView>;
let updates: Array<{ sessionId: string; action: string }>;
let disconnectResponse: (() => Promise<Response>) | undefined;

beforeEach(() => {
  sessions = new Map();
  updates = [];
  disconnectResponse = undefined;
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit = {}) => {
    if (input === "/api/context-capability") return Response.json({ token: "test-capability" });
    if (input === "/api/contexts") {
      return Response.json({ contexts: [{ id: "context", name: "Test login", selected: true, writerActive: false }] });
    }
    if (input.startsWith("/api/browser-live-view?")) {
      return Response.json({ liveUrl: "https://www.browserbase.com/devtools-fullscreen/inspector.html?wss=fixture" });
    }
    if (input === "/api/context-sessions" && init.method === "POST") {
      const session: ContextSessionView = {
        sessionId: `session-${sessions.size + 1}`, contextId: "context", purpose: "login",
        status: "live", challenge: { status: "idle" },
      };
      sessions.set(session.sessionId, session);
      return Response.json({ session });
    }
    if (input === "/api/context-sessions" && init.method === "PATCH") {
      const update = JSON.parse(String(init.body)) as { sessionId: string; action: string };
      updates.push(update);
      if (update.action === "disconnected" && disconnectResponse) return disconnectResponse();
      const current = sessions.get(update.sessionId)!;
      const session: ContextSessionView = { ...current, status: update.action === "finish" ? "saved" : update.action === "disconnected" ? "disconnected" : "live" };
      sessions.set(update.sessionId, session);
      return Response.json({ session });
    }
    if (input.startsWith("/api/context-sessions?")) {
      return Response.json({ session: sessions.get(new URL(input, "http://localhost").searchParams.get("sessionId")!) });
    }
    throw new Error(`Unexpected test request: ${input}`);
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openSession() {
  const start = await screen.findByRole("button", { name: "Start login" });
  await waitFor(() => expect((start as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(start);
  const frame = await screen.findByTitle<HTMLIFrameElement>("Interactive Browserbase login");
  await act(async () => {});
  return frame;
}

async function startStudio() {
  render(<ContextStudio configured />);
  await screen.findByRole("heading", { name: "Test login" });
  fireEvent.change(screen.getByRole("textbox", { name: "Website to open" }), { target: { value: "https://accounts.example.com" } });
  return openSession();
}

function disconnect(frame: HTMLIFrameElement, origin = "https://www.browserbase.com", source: MessageEventSource | null = frame.contentWindow) {
  fireEvent(window, new MessageEvent("message", { data: "browserbase-disconnected", origin, source }));
}

describe("Context Studio Live View lifecycle", () => {
  it("accepts disconnects only from the active trusted iframe and reconnects the same session", async () => {
    const frame = await startStudio();
    disconnect(frame, "https://untrusted.example");
    disconnect(frame, "https://www.browserbase.com", window);
    expect(updates).toEqual([]);
    expect(screen.getByTitle("Interactive Browserbase login")).toBe(frame);

    disconnect(frame);
    fireEvent.click(await screen.findByRole("button", { name: "Reconnect Live View" }));
    await screen.findByTitle("Interactive Browserbase login");
    expect(updates).toEqual([
      { sessionId: "session-1", action: "disconnected" },
      { sessionId: "session-1", action: "reconnected" },
    ]);
  });

  it("uses the new session after finishing a previous one", async () => {
    const previousFrame = await startStudio();
    const previousWindow = previousFrame.contentWindow;
    fireEvent.click(screen.getByRole("button", { name: "Finish login and save" }));
    await screen.findByText("Context saved");
    const frame = await openSession();
    disconnect(frame, "https://www.browserbase.com", previousWindow);
    expect(updates).toEqual([{ sessionId: "session-1", action: "finish" }]);
    disconnect(frame);
    await screen.findByRole("button", { name: "Reconnect Live View" });
    expect(updates.at(-1)).toEqual({ sessionId: "session-2", action: "disconnected" });
  });

  it("shows a failed disconnect update instead of leaving an unhandled rejection", async () => {
    disconnectResponse = async () => Response.json({ error: "Could not update the Context session." }, { status: 500 });
    const frame = await startStudio();
    disconnect(frame);
    expect((await screen.findByRole("alert")).textContent).toContain("Could not update the Context session.");
  });

  it("does not overwrite a new session with a late response from the previous one", async () => {
    let resolve!: (value: Response) => void;
    disconnectResponse = () => new Promise<Response>((done) => { resolve = done; });
    const frame = await startStudio();
    disconnect(frame);
    await waitFor(() => expect(updates).toContainEqual({ sessionId: "session-1", action: "disconnected" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish login and save" }));
    await screen.findByText("Context saved");
    await openSession();
    await act(async () => {
      resolve(Response.json({ session: { ...sessions.get("session-1"), status: "disconnected" } }));
    });
    expect(screen.queryByRole("button", { name: "Reconnect Live View" })).toBeNull();
    expect(screen.getByText("Login session live")).toBeTruthy();
    expect(screen.getByTitle("Interactive Browserbase login")).toBeTruthy();
  });
});
