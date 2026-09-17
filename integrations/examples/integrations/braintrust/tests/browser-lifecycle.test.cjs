const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { z } = require(process.env.COOKBOOK_ZOD_TEST_MODULE || 'zod');
function source(file) {
  return stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'))
    .replace(/^import .*;?\n/gm, '').replace(/export /g, '');
}
function fixture(variant, failures = [], responses) {
  const events = []; let handler;
  const fail = step => { if (failures.includes(step)) throw new Error(`synthetic ${step} failure`); };
  const page = {
    async goto() { events.push('navigate'); fail('navigate'); },
    async textContent() { events.push('extract'); fail('extract'); return 'synthetic text'; },
    async evaluate() { events.push('extract'); fail('extract'); return { title: 'synthetic title', textContent: 'synthetic text' }; },
  };
  const context = {
    process: { env: { BROWSERBASE_API_KEY: 'synthetic', } }, z, AbortSignal,
    braintrust: { projects: { create() { return { tools: { create(tool) { handler = tool.handler; } } }; } } },
    Browserbase: class { sessions = {
      async create(body, options) { events.push('create'); fail('create'); assert.equal(body.keepAlive, true); assert.equal(body.timeout, 300); assert.equal(options.maxRetries, 0); return { id: 'synthetic-session', connectUrl: 'wss://synthetic.test/' }; },
      async update(id, body, options) { events.push('release'); assert.equal(id, 'synthetic-session'); assert.equal(body.status, 'REQUEST_RELEASE'); assert.equal(options.timeout, 10000); fail('release'); },
    }; },
    chromium: { async connectOverCDP(url, options) { events.push('connect'); assert.equal(options.timeout, 10000); fail('connect'); return {
      contexts() { fail('context'); return [{ pages: () => [page] }]; },
      async close() { events.push('close'); fail('close'); },
    }; } },
    fetch: async (url, options) => {
      assert.ok(options.signal);
      const body = JSON.parse(options.body);
      if (body.status === 'REQUEST_RELEASE') {
        events.push('release'); assert.equal(url, 'https://api.browserbase.com/v1/sessions/synthetic-session');
        fail('release'); return { ok: !failures.includes('release-http'), status: 502 };
      }
      events.push('create'); fail('create'); assert.equal(body.keepAlive, true); assert.equal(body.timeout, 300);
      const sample = responses?.shift() ?? { ok: true, body: { id: 'synthetic-session' } };
      return { ok: sample.ok, status: sample.status ?? 200, json: async () => {
        assert.ok(sample.ok, 'HTTP error bodies are not parsed');
        if (sample.invalidJson) throw new Error('sensitive body');
        return sample.body;
      } };
    },
  };
  vm.runInNewContext(source('browser-lifecycle.ts') + source(`${variant}.ts`), context);
  return { events, invoke: () => handler({ url: 'https://example.com' }) };
}

test('both registered handlers release on success and every acquisition or operation failure', async () => {
  for (const variant of ['sdk', 'api']) {
    for (const failure of [null, 'create', 'connect', 'context', 'navigate', 'extract', 'close', 'release']) {
      const run = fixture(variant, failure ? [failure] : []);
      if (failure) await assert.rejects(run.invoke(), new RegExp(`synthetic ${failure} failure`));
      else assert.match((await run.invoke()).page, /synthetic text/);
      assert.equal(run.events.filter(event => event === 'close').length, ['create', 'connect'].includes(failure) ? 0 : 1, `${variant}/${failure}/close`);
      assert.equal(run.events.filter(event => event === 'release').length, failure === 'create' ? 0 : 1, `${variant}/${failure}/release`);
      if (run.events.includes('close')) assert.ok(run.events.indexOf('close') < run.events.indexOf('release'));
    }
  }
});

test('cleanup attempts remain independent and preserve the original operation failure', async () => {
  for (const variant of ['sdk', 'api']) {
    const run = fixture(variant, ['navigate', 'close', 'release']);
    await assert.rejects(run.invoke(), error => {
      assert.equal(error.name, 'AggregateError');
      assert.deepEqual(Array.from(error.errors, value => value.message), ['synthetic navigate failure', 'synthetic close failure', 'synthetic release failure']);
      return true;
    });
    assert.deepEqual(run.events, ['create', 'connect', 'navigate', 'close', 'release']);
  }
});

test('raw API HTTP and schema failures never connect or release an unvalidated ID', async () => {
  for (const response of [
    { ok: false, status: 401 }, { ok: false, status: 429 }, { ok: true, invalidJson: true },
    ...[null, {}, { id: '' }, { id: '../other' }, { id: 3 }, { id: 'a'.repeat(129) }].map(body => ({ ok: true, body })),
  ]) {
    const run = fixture('api', [], [response]);
    await assert.rejects(run.invoke(), /Browserbase (session creation failed|returned)/);
    assert.deepEqual(run.events, ['create']);
  }
  const releaseFailure = fixture('api', ['release-http']);
  await assert.rejects(releaseFailure.invoke(), /release failed.*502/);
  assert.deepEqual(releaseFailure.events, ['create', 'connect', 'navigate', 'extract', 'close', 'release']);
});
