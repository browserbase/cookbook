import { describe, expect, it } from "vitest";

import { browserRunInputSchema } from "../agent/lib/browser-schema.js";

describe("Stagehand run contract", () => {
  it("accepts code mode", () => {
    expect(
      browserRunInputSchema.parse({
        code: 'await page.goto("https://example.com"); return await page.title();',
      }),
    ).toEqual({
      code: 'await page.goto("https://example.com"); return await page.title();',
    });
  });

  it("accepts all official snapshot action operations", () => {
    const actions = [
      { op: "click", id: "1-1" },
      { op: "hover", id: "1-2" },
      { op: "fill", id: "1-3", value: "Miami" },
      { op: "type", id: "1-4", text: "hello", delay: 20 },
      { op: "press", id: "1-5", key: "Enter" },
      { op: "select", id: "1-6", values: ["Lowest price"] },
    ];

    expect(browserRunInputSchema.parse({ actions })).toEqual({ actions });
  });

  it("requires exactly one mode", () => {
    expect(() => browserRunInputSchema.parse({})).toThrow("run requires exactly one");
    expect(() =>
      browserRunInputSchema.parse({
        code: 'return "done";',
        actions: [{ op: "click", id: "1-1" }],
      }),
    ).toThrow("run requires exactly one");
  });

  it("rejects the old custom action fields", () => {
    expect(() =>
      browserRunInputSchema.parse({ actions: [{ action: "click", target: "#submit" }] }),
    ).toThrow();
  });
});
