import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("production start runs the JavaScript emitted by TypeScript", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(import.meta.dirname, "../package.json"), "utf8"),
  );
  assert.equal(pkg.scripts.start, "node dist/server.js");
});
