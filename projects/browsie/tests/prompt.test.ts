import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildClientContext } from "../src/client-context.js";

const instructions = readFileSync(new URL("../agent/instructions.md", import.meta.url), "utf8");

describe("Eve instructions", () => {
  it("states the persistent session and snapshot lifetime", () => {
    expect(instructions).toContain("persistent browser");
    expect(instructions).toContain("latest snapshot");
    expect(instructions).toContain("stop before Submit");
    expect(instructions).toContain("Do not stop at the first obstacle");
    expect(instructions).toContain("which is best?");
  });

  it("adds BrowseLearn memory to one Eve turn", () => {
    const context = buildClientContext(
      "Fresh session",
      "http://127.0.0.1:4318/fixture/form",
      "Prefer direct vendor pages.",
    );
    expect(context.browseLearnMemory).toBe("Prefer direct vendor pages.");
    expect(context.demoFormUrl).toContain("fixture/form");
  });
});
