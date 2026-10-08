import { afterEach, describe, expect, it } from "vitest";

import {
  BrowserHandoffError,
  issueBrowserHandoffToken,
  issueBrowserHandoffUrl,
  resolveBrowserHandoffLiveViewUrl,
  verifyBrowserHandoffToken,
} from "../server/handoff.js";

const secret = "test-only-handoff-secret-with-at-least-32-bytes";
const target = {
  eveSessionId: "wrun_01M1MQKPMZV87YPFE30E58NSVF",
  browserSessionId: "6f906e47-e7bd-4d42-bd1b-e36c49c72e44",
};

describe("browser handoff", () => {
  afterEach(() => {
    delete process.env.BROWSIE_HANDOFF_SECRET;
    delete process.env.BROWSIE_PUBLIC_URL;
  });

  it("issues an opaque URL and verifies its scoped session target", () => {
    const url = issueBrowserHandoffUrl(target, {
      publicUrl: "https://browsie.example",
      secret,
      now: 1_000,
      ttlMs: 60_000,
    });

    expect(url).toMatch(/^https:\/\/browsie\.example\/handoff\/v1\./);
    expect(url).not.toContain(target.eveSessionId);
    expect(url).not.toContain(target.browserSessionId);
    const token = new URL(url).pathname.split("/").at(-1)!;
    expect(verifyBrowserHandoffToken(token, { secret, now: 30_000 })).toEqual({
      ...target,
      expiresAt: 61_000,
    });
  });

  it("rejects tampered and expired links", () => {
    const token = issueBrowserHandoffToken(target, {
      secret,
      now: 10_000,
      ttlMs: 1_000,
    });
    const [version, encodedIv, encodedBody, encodedTag] = token.split(".");
    const tamperedTag = `${encodedTag.startsWith("A") ? "B" : "A"}${encodedTag.slice(1)}`;
    const tamperedToken = [version, encodedIv, encodedBody, tamperedTag].join(".");
    expect(() =>
      verifyBrowserHandoffToken(tamperedToken, {
        secret,
        now: 10_500,
      }),
    ).toThrowError(BrowserHandoffError);
    expect(() => verifyBrowserHandoffToken(token, { secret, now: 11_000 })).toThrowError(
      expect.objectContaining({ code: "expired" }),
    );
  });

  it("resolves only a valid Browserbase Live View URL", async () => {
    const token = issueBrowserHandoffToken(target, {
      secret,
      now: 1_000,
    });
    const resolved = await resolveBrowserHandoffLiveViewUrl(token, {
      secret,
      now: 2_000,
      getDebuggerUrl: async (browserSessionId) => {
        expect(browserSessionId).toBe(target.browserSessionId);
        return "https://www.browserbase.com/devtools-fullscreen/inspector.html?wss=connect.browserbase.com%2Fdebug%2Fsession";
      },
    });
    expect(resolved).toContain("navbar=false");

    await expect(
      resolveBrowserHandoffLiveViewUrl(token, {
        secret,
        now: 2_000,
        getDebuggerUrl: async () => "https://example.com/not-a-live-view",
      }),
    ).rejects.toMatchObject({ code: "unavailable" });
  });

  it("requires a strong secret and an HTTPS public URL", () => {
    expect(() =>
      issueBrowserHandoffUrl(target, {
        publicUrl: "http://browsie.example",
        secret,
      }),
    ).toThrowError(expect.objectContaining({ code: "configuration" }));
    expect(() => issueBrowserHandoffToken(target, { secret: "too-short" })).toThrowError(
      expect.objectContaining({ code: "configuration" }),
    );
  });
});
