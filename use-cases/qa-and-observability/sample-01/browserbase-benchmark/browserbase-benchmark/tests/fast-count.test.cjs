const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../dist/report.js'), 'utf8');
const start = source.indexOf('const CDP_FAST_THRESHOLD');
const end = source.indexOf('// Stats helpers', start);
assert.ok(start >= 0 && end > start);
const context = {};
vm.runInNewContext(source.slice(start, end), context);
const row = (scenario, goto) => ({ competitor: 'browserbase', scenario, site: 'https://example.invalid', runIndex: 0, steps: { goto }, metadata: { navigation: { dns: 0, tcp: 0, tls: 0, ttfb: 0, download: 0, domContentLoaded: 0 } } });

test('each qualifying observation counts even with repeated site/run indexes', () => {
  const data = [row('navigation', 100), row('search', 200), row('search', 200)];
  const result = context.getFastClusterInfo(data);
  assert.equal(result.fastCount, 3);
  assert.equal(result.totalBBCount, 3);
  assert.equal(result.fastPct, 100);
});

test('a fast row never includes a slow row with the same index', () => {
  const fast = row('navigation', 100), slow = row('search', 900);
  const result = context.getFastClusterInfo([fast, slow]);
  assert.equal(result.fastCount, 1);
  assert.equal(result.fastResults.length, 1);
  assert.equal(result.fastResults[0], fast);
  assert.equal(result.fastPct, 50);
});

test('failed and unmeasured rows are outside the denominator', () => {
  const result = context.getFastClusterInfo([{ ...row('failed', 100), error: 'synthetic' }, { ...row('unmeasured', 100), metadata: {} }]);
  assert.equal(result.totalBBCount, 0);
  assert.equal(result.fastCount, 0);
  assert.equal(result.fastPct, 0);
});
