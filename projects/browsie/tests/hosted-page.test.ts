import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowsieBrowserSession, browserbaseLaunchOptions } from "../server/browser-session";
import type { ConversationState } from "../server/types";

function fixture(loggingDisabled = true) {
  const state: ConversationState = {
    id: "shared-test",
    traces: [],
    browser: { provider: "not-started", status: "idle" },
  };
  const session = new BrowsieBrowserSession(state);
  const page = {
    url: async () => "https://example.com/",
    title: async () => "Example",
  };
  vi.spyOn(session, "start").mockResolvedValue();
  vi.spyOn(
    session as unknown as { gateCaptcha(): Promise<void> },
    "gateCaptcha",
  ).mockResolvedValue();
  Object.assign(session, {
    sessionLogsDisabled: loggingDisabled,
    remoteSessionId: "private-session",
    browser: { context: { activePage: async () => page } },
    browserbase: {
      sessions: {
        retrieve: async () => ({ connectUrl: "wss://private-connection" }),
      },
    },
  });
  return { session, state, page };
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe("shared hosted-page integration boundary", () => {
  it("uses the existing page and exposes only the callback result", async () => {
    const { session, state, page } = fixture();
    const operation = vi.fn(async (active, connection) => {
      expect(active).toBe(page);
      expect(connection).toBe("wss://private-connection");
      return { accepted: true };
    });
    expect(await session.withHostedPage(new AbortController().signal, operation)).toEqual({
      accepted: true,
    });
    expect(state.browser.url).toBe("https://example.com/");
    expect(JSON.stringify(state)).not.toContain("private-connection");
  });
  it("refuses credential integrations when the session may record network headers", async () => {
    const { session } = fixture(false);
    const operation = vi.fn();
    await expect(session.withHostedPage(new AbortController().signal, operation)).rejects.toThrow(
      "BROWSIE_LOG_SESSION=false",
    );
    expect(operation).not.toHaveBeenCalled();
  });
  it("does no work for an already-cancelled call", async () => {
    const { session } = fixture();
    const operation = vi.fn();
    await expect(session.withHostedPage(AbortSignal.abort(), operation)).rejects.toThrow();
    expect(operation).not.toHaveBeenCalled();
  });
  it("releases the operation lock after a failed callback", async () => {
    const { session } = fixture();
    await expect(
      session.withHostedPage(new AbortController().signal, async () => {
        throw new Error("failed");
      }),
    ).rejects.toThrow("failed");
    await expect(
      session.withHostedPage(new AbortController().signal, async () => "next"),
    ).resolves.toBe("next");
  });
  it("explicitly disables hosted network recording when requested", () => {
    vi.stubEnv("BROWSIE_LOG_SESSION", "false");
    const options = browserbaseLaunchOptions("test-key");
    expect(options.browserSettings.logSession).toBe(false);
    expect(options.userMetadata.networkLogging).toBe("false");
  });
});
