import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { stripTypeScriptTypes } from "node:module";

const directory = path.resolve(import.meta.dirname, "..");
const storeSource = stripTypeScriptTypes(
  fs.readFileSync(path.join(directory, "lib/session-store.ts"), "utf8"),
);
const store = await import(`data:text/javascript,${encodeURIComponent(storeSource)}`);

test("terminal sessions reject late answers", () => {
  store.createSession("complete");
  store.setQuestion("complete", "fixture?", () => {}, () => {});
  store.completeSession("complete");
  assert.equal(store.resolveQuestion("complete", "late"), false);
  assert.equal(store.getSession("complete").status, "complete");
});

test("cancellation rejects a pending human wait and prevents revival", async () => {
  store.createSession("cancelled");
  const waiting = new Promise((resolve, reject) =>
    store.setQuestion("cancelled", "fixture?", resolve, reject),
  );
  store.cancelSession("cancelled", "disconnected");
  await assert.rejects(waiting, /disconnected/);
  assert.equal(store.resolveQuestion("cancelled", "late"), false);
  store.deleteSession("cancelled");
  assert.equal(store.getSession("cancelled"), undefined);
});

test("completion requires an explicit observed-confirmation tool result", () => {
  const source = fs.readFileSync(path.join(directory, "lib/agent.ts"), "utf8");
  assert.match(source, /if \(!submissionConfirmation\)[\s\S]*throw new Error/);
  assert.match(source, /Human response deadline expired/);
  assert.doesNotMatch(source, /sessions\.list/);
  assert.doesNotMatch(source, /result\.text \|\| "Application submitted"/);
});

test("route enforces server-side resume validation and request cancellation", () => {
  const source = fs.readFileSync(path.join(directory, "app/api/agent/route.ts"), "utf8");
  assert.match(source, /MAX_RESUME_BYTES = 10 \* 1024 \* 1024/);
  assert.match(source, /ALLOWED_RESUME_TYPES/);
  assert.match(source, /Buffer\.byteLength\(resumeBase64, "base64"\)/);
  assert.match(source, /signal: req\.signal/);
});

test("client treats HTTP errors and nonterminal EOF as failures", () => {
  const source = fs.readFileSync(path.join(directory, "app/page.tsx"), "utf8");
  assert.match(source, /if \(!res\.ok\) throw new Error/);
  assert.match(source, /if \(!sawTerminalEvent\) throw new Error/);
  assert.match(source, /resumeMimeType: resumeFile\.type/);
});
