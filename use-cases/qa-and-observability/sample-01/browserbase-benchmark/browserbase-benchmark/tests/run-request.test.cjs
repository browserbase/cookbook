const {checkAccess, validSites}=require('../dist/access.js');
const token='a'.repeat(64);
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');

function fixture() {
  let dispatched = 0;
  const source = fs.readFileSync(path.join(__dirname, '../dist/server.js'), 'utf8');
  const code = source.slice(0, source.indexOf('const PORT =')).replace(/^import .*;\r?\n/gm, '');
  const context = { checkAccess, validSites, Buffer,
    randomUUID: require("node:crypto").randomUUID,
    process: { env: { BENCHMARK_ACCESS_TOKEN:token, BENCHMARK_SITES: 'https://example.invalid' } },
    console: { log() {}, error() {} },
    discoverScenarios: async () => [], discoverCompetitors: async () => [],
    runBenchmark: () => { dispatched++; return new Promise(() => {}); },
  };
  vm.runInNewContext(code, context);
  function begin() {
    const req = Object.assign(new EventEmitter(), { url: '/run', method: 'POST', headers:{authorization:'Bearer '+token} });
    const res = { setHeader() {}, writeHead(status) { this.status = status; }, end(body) { this.body = JSON.parse(body); } };
    return { req, res, finished: context.handler(req, res) };
  }
  async function send(body) {
    const request = begin();
    request.req.emit('data', body);
    request.req.emit('end');
    await request.finished;
    return request.res;
  }
  return { begin, send, dispatched: () => dispatched };
}

test('invalid bodies return400 and leave a valid follow-up available', async () => {
  for (const body of ['null', '[1]', 'true', '{bad', '{"runs":0}', '{"runs":1.5}', '{"sites":42}']) {
    const f = fixture();
    assert.equal((await f.send(body)).status, 400, body);
    assert.equal((await f.send('{}')).status, 202);
  }
});

test('interrupted body reads do not dispatch default work or wedge state', async () => {
  const f = fixture();
  const request = f.begin();
  request.req.emit('error', new Error('synthetic disconnect'));
  await request.finished;
  assert.equal(request.res.status, 400);
  assert.equal(f.dispatched(), 0);
  assert.equal((await f.send('{}')).status, 202);
});

test('overlapping body reads accept exactly one run', async () => {
  const f = fixture();
  const first = f.begin();
  const second = f.begin();
  for (const request of [second, first]) {
    request.req.emit('data', '{}');
    request.req.emit('end');
  }
  await Promise.all([first.finished, second.finished]);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual([first.res.status, second.res.status].sort(), [202, 409]);
  assert.equal(f.dispatched(), 1);
});
