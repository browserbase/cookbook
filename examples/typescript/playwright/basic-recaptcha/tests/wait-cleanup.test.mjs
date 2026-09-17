import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const code = stripTypeScriptTypes(readFileSync(new URL('../index.ts', import.meta.url), 'utf8'))
  .replace(/^import .*;$/gm, '').replace('main().catch(', 'globalThis.done = main().catch(');
async function run(change = {}) {
  let listener, closed = false, submitted = false;
  const timers = new Map(), exits = [];
  const page = {
    on: (name, callback) => { assert.equal(name, 'console'); listener = callback; },
    off: (name, callback) => { assert.equal(name, 'console'); assert.equal(callback, listener); listener = undefined; },
    goto: async () => {
      assert.ok(listener);
      if (change.navigationFails) throw Error('synthetic navigation failure');
      if (change.early) listener({ text: () => 'browserbase-solving-finished' });
    },
    click: async () => { assert.equal(timers.size, 0, 'clear the wait timer before submitting'); submitted = true; if (change.clickFails) throw Error('synthetic click failure'); },
    waitForLoadState: async () => {}, textContent: async () => 'Synthetic result',
  };
  const browser = { contexts: () => [{ pages: () => [page] }], close: async () => { closed = true; } };
  const context = vm.createContext({
    chromium: { connectOverCDP: async () => browser }, Browserbase: class { sessions = { create: async () => ({ id: 'synthetic', connectUrl: 'synthetic' }) }; },
    process: { env: { BROWSERBASE_API_KEY: 'synthetic' }, exit: code => exits.push(code) }, console: { log() {}, error() {} },
    setTimeout: (callback, ms) => {
      assert.equal(ms, 60000); const id = Symbol(); timers.set(id, callback);
      queueMicrotask(() => change.timeout ? callback() : listener({ text: () => 'browserbase-solving-finished' }));
      return id;
    },
    clearTimeout: id => timers.delete(id),
  });
  vm.runInContext(code, context); await context.done;
  return { listener, closed, submitted, timers, exits };
}
for (const change of [{}, { early: true }, { timeout: true }, { navigationFails: true }, { clickFails: true }]) test(`Playwright waiter cleanup ${JSON.stringify(change)}`, async () => {
  const r = await run(change); assert.equal(r.closed, true); assert.equal(r.listener, undefined); assert.equal(r.timers.size, 0);
  assert.deepEqual(r.exits, change.timeout || change.navigationFails || change.clickFails ? [1] : []);
  assert.equal(r.submitted, !(change.timeout || change.navigationFails));
});
