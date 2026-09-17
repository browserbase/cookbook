import { beforeEach, expect, it, vi } from "vitest";
const adapter = vi.hoisted(() => ({
  startSession: vi.fn(async () => ({ sessionId: "synthetic-session", projectId: "derived-project" })),
  endSession: vi.fn(async () => {}),
  navigate: vi.fn(async () => {}),
  extract: vi.fn(async () => ({ result: { value: "synthetic" } })),
  act: vi.fn(async () => ({ result: { success: true, message: "ok", actionDescription: "test" } })),
  observe: vi.fn(async () => ({ result: [] })),
  runBrowserTask: vi.fn(async () => ({ result: { actions: [], completed: true, message: "ok", success: true } })),
}));
vi.mock("./api.js", () => adapter);
import * as actions from "./lib.js";
const config = { browserbaseApiKey: "synthetic", modelApiKey: "synthetic" };
const names = ["startSession", "extract", "act", "observe", "agent"] as const;
function invoke(name: typeof names[number], ctx: unknown, extra = {}) {
  const action = actions[name] as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> };
  return action._handler(ctx, { ...config, url: "https://example.com", instruction: "test", action: "test", schema: {}, ...extra });
}
beforeEach(() => { vi.clearAllMocks(); adapter.endSession.mockReset().mockResolvedValue(); });
for (const name of names) {
  it(`${name} releases allocation after metadata failure even when database reads also fail`, async () => {
    const failure = new Error("metadata unavailable");
    const ctx = { runMutation: vi.fn().mockRejectedValue(failure), runQuery: vi.fn().mockRejectedValue(failure) };
    await expect(invoke(name, ctx)).rejects.toBe(failure);
    expect(adapter.endSession).toHaveBeenCalledExactlyOnceWith("synthetic-session", expect.objectContaining(config));
    expect(adapter.navigate).not.toHaveBeenCalled();
  });
  it(`${name} retains both metadata and release failures`, async () => {
    const metadata = new Error("metadata unavailable"), release = new Error("release unavailable");
    adapter.endSession.mockRejectedValueOnce(release);
    const ctx = { runMutation: vi.fn().mockRejectedValue(metadata), runQuery: vi.fn().mockRejectedValue(metadata) };
    await expect(invoke(name, ctx)).rejects.toMatchObject({ errors: [metadata, release] });
    expect(adapter.endSession).toHaveBeenCalledOnce();
  });
}

it("does not release a caller-supplied session after metadata failure", async () => {
  const failure = new Error("metadata unavailable");
  await expect(invoke("startSession", {runMutation: vi.fn().mockRejectedValue(failure)}, {browserbaseSessionID: "synthetic-session"})).rejects.toBe(failure);
  expect(adapter.endSession).not.toHaveBeenCalled();
});
for (const name of names) {
  it(`${name} continues after successful metadata storage`, async () => {
    const ctx = {runMutation: vi.fn().mockResolvedValue(null), runQuery: vi.fn().mockResolvedValue("us-west-2")};
    await invoke(name, ctx);
    expect(adapter.navigate).toHaveBeenCalledOnce();
    expect(adapter.endSession).toHaveBeenCalledTimes(name === "startSession" ? 0 : 1);
  });
}

for (const name of names) {
  it(`${name} releases after navigation failure despite unavailable metadata reads`, async () => {
    const navigation = new Error("navigation unavailable");
    adapter.navigate.mockRejectedValueOnce(navigation);
    const ctx = {runMutation: vi.fn().mockResolvedValueOnce(null).mockRejectedValue(new Error("write unavailable")), runQuery: vi.fn().mockRejectedValue(new Error("read unavailable"))};
    await expect(invoke(name, ctx)).rejects.toBe(navigation);
    expect(adapter.endSession).toHaveBeenCalledOnce();
    expect(ctx.runQuery).not.toHaveBeenCalled();
  });
}
