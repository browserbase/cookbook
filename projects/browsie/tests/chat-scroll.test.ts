import { describe, expect, it } from "vitest";

import { isNearScrollBottom } from "../src/chat-scroll";

describe("chat scroll behavior", () => {
  it("follows messages when the user is near the bottom", () => {
    expect(
      isNearScrollBottom({
        scrollTop: 810,
        clientHeight: 600,
        scrollHeight: 1500,
      }),
    ).toBe(true);
  });

  it("does not move the view when the user reads an older message", () => {
    expect(
      isNearScrollBottom({
        scrollTop: 500,
        clientHeight: 600,
        scrollHeight: 1500,
      }),
    ).toBe(false);
  });

  it("supports a stricter threshold", () => {
    const metrics = {
      scrollTop: 810,
      clientHeight: 600,
      scrollHeight: 1500,
    };

    expect(isNearScrollBottom(metrics, 80)).toBe(false);
  });
});
