const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

for (const fails of [false, true]) test(`startup is measured before scenario ${fails ? 'failure' : 'success'}`, async () => {
  let now = 0, closes = 0;
  const timers = new Set();
  const source = fs.readFileSync(path.join(__dirname, '../dist/runner.js'), 'utf8');
  const start = source.indexOf('async function runOnce(');
  const end = source.indexOf('async function main(', start);
  const context = { RunResources: require('../dist/run-resources.js').RunResources, AbortController, clearTimeout(timer) { assert.ok(timers.delete(timer)); }, Date: { now: () => now }, setTimeout() { const timer = {}; timers.add(timer); return timer; } };
  vm.runInNewContext(source.slice(start, end), context);
  const competitor = { name: 'synthetic', createStagehand: async () => {
    now += 150;
    return { browser: { context: { pages: async () => [{}] }, close: async () => { closes++; } }, close: async () => {} };
  } };
  const scenario = { name: 'synthetic', steps: [{ name: 'action', run: async () => {
    if (fails) throw new Error('Synthetic failure');
    now += 25;
  } }] };
  const result = await context.runOnce(competitor, scenario, 'https://example.invalid', 0);
  assert.equal(result.steps.init, 150);
  assert.equal(result.total, fails ? 150 : 175);
  assert.equal(Boolean(result.error), fails);
  assert.equal(closes, 1);
  assert.equal(timers.size, 0);
});
