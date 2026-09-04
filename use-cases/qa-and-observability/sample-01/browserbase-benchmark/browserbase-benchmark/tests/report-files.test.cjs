const {checkAccess, validSites}=require('../dist/access.js');
const token='a'.repeat(64);
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cookbook-report-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'results'));
  const report = await import('../dist/report.js');
  const source = fs.readFileSync(path.join(__dirname, '../dist/server.js'), 'utf8');
  const code = source.slice(0, source.indexOf('const PORT =')).replace(/^import .*;\r?\n/gm, '');
  const context = { checkAccess, validSites, Buffer, ...fs, ...path, URLSearchParams, console: { error() {} }, process: { cwd: () => root, env: {BENCHMARK_ACCESS_TOKEN:token} }, generateReportHtml: report.generateReportHtml };
  vm.runInNewContext(code, context);
  const row = { competitor: 'local-chromium', scenario: 'synthetic', site: 'https://example.invalid', runIndex: 0, steps: { goto: 100 }, total: 100 };
  fs.writeFileSync(path.join(root, 'results', 'valid.json'), JSON.stringify([row]));
  async function request(name) {
    const res = { setHeader() {}, writeHead(status) { this.status = status; }, end(body) { this.body = body; } };
    await context.handler({ headers:{authorization:'Bearer '+token}, method: 'GET', url: '/report?files=' + encodeURIComponent(name) }, res);
    return res;
  }
  return { root, row, request, report };
}

test('serves known result IDs with or without the JSON suffix', async t => {
  const { request } = await fixture(t);
  for (const id of ['valid', 'valid.json']) assert.equal((await request(id)).status, 200);
});

test('rejects traversal and symlinks to sibling data', async t => {
  const { root, row, request } = await fixture(t);
  fs.writeFileSync(path.join(root, 'sibling.json'), JSON.stringify([row]));
  fs.symlinkSync('../sibling.json', path.join(root, 'results', 'linked.json'));
  for (const id of ['../sibling', '..\\sibling', '%2e%2e%2fsibling', '<script>', 'linked']) {
    assert.equal((await request(id)).status, 400, id);
  }
});

test('rejects missing-only and mixed missing selections', async t => {
  const { request } = await fixture(t);
  for (const id of ['missing', 'valid,missing']) assert.equal((await request(id)).status, 404);
});

test('explains empty data while preserving reports containing failed runs', async t => {
  const { root, row, request, report } = await fixture(t);
  fs.writeFileSync(path.join(root, 'results', 'empty.json'), '[]');
  fs.writeFileSync(path.join(root, 'results', 'failed.json'), JSON.stringify([{ ...row, error: 'Synthetic failure' }]));
  assert.equal((await request('empty')).status, 422);
  assert.equal((await request('failed')).status, 200);
  assert.throws(() => report.generateReportHtml([]), /No result data/);
});
