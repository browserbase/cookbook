const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module");

const root = path.join(__dirname, "..");
function source(name) {
  return stripTypeScriptTypes(fs.readFileSync(path.join(root, name), "utf8"))
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];\n/gm, "").replace(/export /g, "");
}

test("excluded browser tools are absent from the actual generated tool map and unknown names fail", async () => {
  let captured;
  const tool = spec => spec;
  const context = { process: { env: {} }, createOpenAI: () => () => ({}), stepCountIs: () => () => false, tool,
    z: require("../../../../../playbook/node/node_modules/zod").z,
    generateText: async opts => { captured = opts.tools; return { steps: [], text: "", totalUsage: {} }; }, setTimeout };
  vm.runInNewContext(source("browser-task.ts") + "\nthis.runBrowserTask=runBrowserTask", context);
  const stagehand = { browser: { context: { activePage: async () => ({}) } } };
  await context.runBrowserTask(stagehand, "synthetic", { model: {}, excludeTools: ["act", "navigate"] });
  assert.equal("act" in captured, false); assert.equal("navigate" in captured, false); assert.equal("inspect" in captured, true);
  await assert.rejects(context.runBrowserTask(stagehand, "synthetic", { model: {}, excludeTools: ["fillForm"] }), /Unknown excluded/);
});

test("download helper rejects non-archives and isolates validated extraction", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "portal-artifact-"));
  const fake = bytes => ({ sessions: { downloads: { list: async () => ({ arrayBuffer: async () => bytes }) } } });
  const context = { Buffer, Date, setTimeout, mkdirSync: fs.mkdirSync, writeFileSync: fs.writeFileSync, join: path.join,
    execFileSync: require("node:child_process").execFileSync };
  vm.runInNewContext(source("src/bb.ts") + "\nthis.fetchSessionDownloads=fetchSessionDownloads", context);
  const invalid = await context.fetchSessionDownloads(fake(Buffer.from("not a zip response with enough synthetic bytes xxxxxxxxx")), "s1", path.join(tmp,"one"), { timeoutMs: 20, intervalMs: 1 });
  assert.equal(invalid, null);
  const archiveDir = path.join(tmp, "make"); fs.mkdirSync(archiveDir); fs.writeFileSync(path.join(archiveDir,"customers.csv"), "first");
  require("node:child_process").execFileSync("zip", ["-q", path.join(tmp,"valid.zip"), "customers.csv"], { cwd: archiveDir });
  const validBytes = fs.readFileSync(path.join(tmp,"valid.zip"));
  const first = await context.fetchSessionDownloads(fake(validBytes), "s2", path.join(tmp,"two"), { timeoutMs: 20, intervalMs: 1 });
  assert.ok(first); assert.equal(fs.readFileSync(path.join(tmp,"two","extracted","customers.csv"),"utf8"), "first");
});

test("stats honors the persisted verdict and URL checks enforce path boundaries", () => {
  const stats = { resolve: path.resolve, join: path.join, process, existsSync: fs.existsSync };
  vm.runInNewContext(source("src/stats.ts") + "\nthis.tracePassed=tracePassed", stats);
  assert.equal(stats.tracePassed({ success: true, passed: false, acceptanceVersion: 1 }), false);
  assert.equal(stats.tracePassed({ success: false, passed: true, acceptanceVersion: 1 }), true);
  const checks = { URL };
  const checkSource = source("scripts/check-context.ts").replace(/main\(\)\.catch[\s\S]*$/, "");
  vm.runInNewContext(checkSource + "\nthis.isWithinAuthedArea=isWithinAuthedArea", checks);
  assert.equal(checks.isWithinAuthedArea("https://app.invalid/dashboard/", "https://app.invalid/dashboard/orders"), true);
  assert.equal(checks.isWithinAuthedArea("https://app.invalid/dashboard/", "https://app.invalid/dashboard-login"), false);
  assert.equal(checks.isWithinAuthedArea("https://app.invalid/dashboard/", "https://evil.invalid/dashboard/"), false);
});
