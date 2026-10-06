import { describe, expect, it } from "vitest";

import { redactText, redactValue } from "../server/redact.js";

describe("trace redaction", () => {
  it("removes Browserbase and model keys", () => {
    const text = redactText(
      "BROWSERBASE_API_KEY=bb_live_abcdefghijkl OPENAI_API_KEY=sk-abcdefghijklmnop",
    );
    expect(text).not.toContain("bb_live_abcdefghijkl");
    expect(text).not.toContain("sk-abcdefghijklmnop");
  });

  it("redacts nested values", () => {
    const result = redactValue({ input: { password: "password=hunter2" } });
    expect(JSON.stringify(result)).not.toContain("hunter2");
  });
});
