import { describe, expect, it } from "vitest";

import { redactText, redactValue } from "../server/redact.js";

describe("trace redaction", () => {
  it("removes Browserbase and model keys", () => {
    const browserbaseKey = ["bb", "live", "abcdefghijkl"].join("_");
    const openaiKey = ["sk", "abcdefghijklmnop"].join("-");
    const text = redactText(`BROWSERBASE_API_KEY=${browserbaseKey} OPENAI_API_KEY=${openaiKey}`);
    expect(text).not.toContain(browserbaseKey);
    expect(text).not.toContain(openaiKey);
  });

  it("redacts nested values", () => {
    const result = redactValue({ input: { password: "password=hunter2" } });
    expect(JSON.stringify(result)).not.toContain("hunter2");
  });
});
