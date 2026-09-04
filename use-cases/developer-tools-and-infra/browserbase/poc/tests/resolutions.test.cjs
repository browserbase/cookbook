const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module");

function source(name) {
  return stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, "../src", name), "utf8"))
    .replace(/^import .*;\n/gm, "").replace(/export /g, "");
}

test("feature overrides stay partial and numeric overrides reject partial or non-positive input", () => {
  const context = { z: require("../../../../../playbook/node/node_modules/zod").z, process: { env: {} }, URL };
  vm.runInNewContext(source("types.ts") + "\n" + source("config.ts") + "\nthis.SiteSchema=SiteSchema;this.effectiveFeatures=effectiveFeatures;this.positiveInteger=positiveInteger;this.applyAttemptOverride=applyAttemptOverride", context);
  const parsed = context.SiteSchema.parse({ url: "https://same.invalid", task: "first", features: { proxies: false } });
  assert.deepEqual(Object.keys(parsed.features), ["proxies"]);
  assert.equal(JSON.stringify(context.effectiveFeatures({ advancedStealth: false, proxies: true, solveCaptchas: false, blockAds: false }, parsed.features)),
    JSON.stringify({ advancedStealth: false, proxies: false, solveCaptchas: false, blockAds: false }));
  assert.equal(context.positiveInteger("2"), 2);
  for (const bad of ["-1", "0", "2junk", "junk"]) assert.throws(() => context.positiveInteger(bad), /positive integer/);
  const manifest = { defaults: { attempts: 3 }, sites: [{ attempts: 5 }, {}] };
  context.applyAttemptOverride(manifest, undefined, true);
  assert.equal(JSON.stringify(manifest.sites.map(site => site.attempts)), "[1,1]");
});

test("scorecard separates duplicate URLs by site identity and records each effective posture", () => {
  const context = { URL };
  vm.runInNewContext(source("scorecard.ts") + "\nthis.buildScorecard=buildScorecard", context);
  const features = { advancedStealth: true, proxies: true, solveCaptchas: true, blockAds: true };
  const manifest = { name: "trial", defaults: { target: .5, features, region: "x", model: "m" }, sites: [
    { url: "https://same.invalid", task: "pass", features: { proxies: false } },
    { url: "https://same.invalid", task: "fail", features: { advancedStealth: false } },
  ]};
  const attempt = (siteId, success, siteFeatures) => ({ siteId, site: siteId, url: "https://same.invalid", attempt: 1,
    outcome: success ? "pass" : "error", success, reason: "synthetic", durationMs: 1, features: siteFeatures });
  const score = context.buildScorecard(manifest, [attempt("site-0", true, {...features, proxies:false}), attempt("site-1", false, {...features, advancedStealth:false})], "a", "b");
  assert.deepEqual(score.sites.map(s => [s.passes, s.attempts]), [[1,1],[0,1]]);
  assert.equal(score.sites[0].features.proxies, false);
  assert.equal(score.sites[1].features.advancedStealth, false);
});
