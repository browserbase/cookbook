import { describe, expect, it } from "vitest";

import { formatRunCode, redactActivityCode } from "../server/browser-session.js";

describe("run activity code", () => {
  it("shows exact browser calls and hides entered values", () => {
    const code = formatRunCode(
      [
        { op: "fill", id: "1-2", value: "person@example.com" },
        { op: "fill", id: "1-3", value: "hunter2" },
        { op: "click", id: "1-4" },
      ],
      ["xpath=//input[1]", "xpath=//input[2]", "xpath=//button[1]"],
    );

    expect(code).toContain('page.locator("xpath=//input[1]").fill("[value hidden]")');
    expect(code).toContain('page.locator("xpath=//button[1]").click()');
    expect(code).not.toContain("person@example.com");
    expect(code).not.toContain("hunter2");
  });

  it("shows model-authored code and hides entered values and URL secrets", () => {
    const code = redactActivityCode(`
      await page.goto("https://example.com/login?token=secret");
      const password = "another-secret";
      await page.locator("#email").fill("person@example.com");
      await page.locator("#password").type("hunter2");
      await page.locator("#role").selectOption("Admin");
    `);

    expect(code).toContain("await page.goto");
    expect(code).toContain('.fill("[value hidden]")');
    expect(code).not.toContain("person@example.com");
    expect(code).not.toContain("hunter2");
    expect(code).not.toContain("another-secret");
    expect(code).not.toContain("Admin");
    expect(code).not.toContain("token=secret");
  });
});
