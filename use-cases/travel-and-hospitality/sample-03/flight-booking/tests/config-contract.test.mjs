import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const directory = path.resolve(import.meta.dirname, "..");
const main = fs.readFileSync(path.join(directory, "src/main.ts"), "utf8");
const utils = fs.readFileSync(path.join(directory, "src/utils.ts"), "utf8");

test("configuration validation precedes browser allocation", () => {
  assert.ok(main.indexOf("validateBookingConfig(this.config)") < main.indexOf("Stagehand.create("));
  assert.doesNotMatch(main, /2025-09-(15|22)/);
});

test("browser task failures are promoted to workflow failures", () => {
  assert.match(main, /if \(!outcome\.completed\)[\s\S]*throw new Error/);
});

test("date and passenger validation rejects non-values", () => {
  assert.match(utils, /Number\.isNaN\(departureDate\.getTime\(\)\)/);
  assert.match(utils, /Number\.isNaN\(returnDate\.getTime\(\)\)/);
  assert.match(utils, /Number\.isInteger\(config\.passengers\)/);
});
