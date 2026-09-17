import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const source = stripTypeScriptTypes(readFileSync(new URL('../index.ts', import.meta.url), 'utf8'))
  .replace(/^import .*;$/gm, '').replace('main().catch(', 'globalThis.done = main().catch(');

async function run(change = {}) {
  const calls = [], closed = [], logs = [], exits = [], timers = new Map(), deadlines = [];
  let listener, unsubscribed = 0, started = false;
  const finished = { params: { args: [{ value: 'browserbase-solving-finished' }] } };
  const page = {
    on: async (name, callback) => {
      assert.equal(name, 'console'); assert.equal(started, false, 'listen before navigating');
      if (change.subscribeFails) throw new Error('synthetic subscribe failure');
      listener = callback;
      return { unsubscribe: async () => { unsubscribed++; listener = undefined; if (change.unsubscribeFails) throw new Error('synthetic unsubscribe failure'); } };
    },
    goto: async (_url, options) => {
      started = true; assert.ok(listener, 'completion listener must already be active'); assert.ok(options.timeout > 0);
      if (change.navigationFails) throw new Error('synthetic navigation failure');
      if (change.timeout) { assert.equal(timers.size, 1); for (const callback of timers.values()) callback(); }
      else {
        listener({ params: { args: null } });
        listener({ params: { args: [null, 7, { other: 'ignored' }, { value: 'unrelated' }] } });
        listener({ params: { args: [{ value: 'browserbase-solving-started' }] } });
        listener(finished);
        if (change.duplicate) listener(finished);
      }
    },
  };
  const browser = { context: { pages: async () => [page] }, close: async () => { closed.push('browser'); } };
  const stagehand = {
    act: async (_instruction, options) => { assert.equal(options.page, page); calls.push('act'); return { data: { success: !change.actionFails } }; },
    extract: async (...args) => { assert.equal(args.at(-1).page, page); calls.push('extract'); if (change.extractFails) throw new Error('synthetic extract failure'); return { data: 'Synthetic demo response' }; },
    close: async () => { closed.push('stagehand'); if (change.closeFails) throw new Error('synthetic close failure'); },
  };
  const context = vm.createContext({
    browserbase: { launch: async () => { if (change.launchFails) throw new Error('synthetic launch failure'); return browser; } },
    Stagehand: { create: async () => { if (change.initFails) throw new Error('synthetic initialization failure'); return stagehand; } },
    process: { env: { BROWSERBASE_API_KEY: 'synthetic' }, exit: code => exits.push(code) },
    console: { log: (...args) => logs.push(args.join(' ')), error: () => {} },
    setTimeout: (callback, ms) => { const id = Symbol(); timers.set(id, callback); deadlines.push(ms); return id; },
    clearTimeout: id => { timers.delete(id); },
  });
  vm.runInContext(source, context);
  await context.done;
  return { calls, closed, logs, exits, timers, deadlines, unsubscribed, listener };
}

test('completion during navigation is retained and timer/listener removed', async () => {
  const r = await run(); assert.deepEqual(r.exits, []); assert.deepEqual(r.calls, ['act', 'extract']);
  assert.deepEqual(r.closed, ['stagehand', 'browser']); assert.equal(r.unsubscribed, 1); assert.equal(r.listener, undefined);
  assert.equal(r.timers.size, 0); assert.deepEqual(r.deadlines, [60000]);
});

test('duplicate completion does not submit twice', async () => {
  const r = await run({ duplicate: true }); assert.deepEqual(r.exits, []); assert.deepEqual(r.calls, ['act', 'extract']); assert.equal(r.timers.size, 0);
});

for (const change of [{ timeout: true }, { navigationFails: true }, { subscribeFails: true }, { actionFails: true }, { extractFails: true }, { unsubscribeFails: true }, { closeFails: true }, { initFails: true }, { launchFails: true }]) test(`failure propagates and releases resources ${JSON.stringify(change)}`, async () => {
  const r = await run(change); assert.deepEqual(r.exits, [1]); assert.equal(r.timers.size, 0);
  assert.deepEqual(r.closed, change.launchFails ? [] : change.initFails ? ['browser'] : ['stagehand', 'browser']);
  assert.equal(r.unsubscribed, change.launchFails || change.initFails || change.subscribeFails ? 0 : 1);
  if (change.timeout || change.navigationFails || change.subscribeFails || change.initFails || change.launchFails) assert.deepEqual(r.calls, []);
  if (change.actionFails) assert.deepEqual(r.calls, ['act']);
});
