const {checkAccess, validSites}=require('../dist/access.js');
const token='a'.repeat(64);
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');

test('results stay bound to the accepted run across subsequent runs', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cookbook-run-id-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const pending = [];
  const source = fs.readFileSync(path.join(__dirname, '../dist/server.js'), 'utf8');
  const code = source.slice(0, source.indexOf('const PORT =')).replace(/^import .*;\r?\n/gm, '');
  const context = { checkAccess, validSites, Buffer, ...fs, ...path, randomUUID, URLSearchParams, process: { cwd: () => root, env: {BENCHMARK_ACCESS_TOKEN:token} }, console: { log() {}, error() {} }, discoverScenarios: async () => [], discoverCompetitors: async () => [], runBenchmark: () => new Promise(resolve => pending.push(resolve)) };
  vm.runInNewContext(code, context);
  async function request(url, body) {
    const req = Object.assign(new EventEmitter(), { headers:{authorization:'Bearer '+token}, url, method: body === undefined ? 'GET' : 'POST' });
    const res = { setHeader() {}, writeHead(status) { this.status = status; }, end(value) { this.body = JSON.parse(value); } };
    const done = context.handler(req, res);
    if (body !== undefined) { req.emit('data', JSON.stringify(body)); req.emit('end'); }
    await done;
    await new Promise(resolve => setImmediate(resolve));
    return res;
  }
  const a = await request('/run', { sites: 'https://first.invalid', runs: 1 });
  assert.equal(a.status, 202);
  assert.equal(typeof a.body.runId, 'string');
  const getA = '/results?runId=' + a.body.runId;
  assert.equal((await request(getA)).status, 202);
  assert.equal((await request('/results')).status, 400);
  assert.equal((await request('/results?runId=unknown')).status, 404);
  pending.shift()([{ site: 'https://first.invalid' }]);
  await new Promise(resolve => setImmediate(resolve));
  const b = await request('/run', { sites: 'https://second.invalid', runs: 1 });
  assert.notEqual(a.body.runId, b.body.runId);
  assert.equal((await request(getA)).body[0].site, 'https://first.invalid');
  pending.shift()([{ site: 'https://second.invalid' }]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((await request(getA)).body[0].site, 'https://first.invalid');
  assert.equal((await request('/results?runId=' + b.body.runId)).body[0].site, 'https://second.invalid');
  assert.equal((await request('/results?runId=../outside')).status, 400);
});
