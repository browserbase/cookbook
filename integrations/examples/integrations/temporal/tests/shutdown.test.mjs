import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const path = new URL('../src/research-worker.ts', import.meta.url);
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture({ creationFailure = false, runFailure = false } = {}) {
  const process = new EventEmitter();
  const calls = { shutdown: 0, exit: [], logs: [], options: undefined, drained: false };
  process.exit = code => calls.exit.push({ code, drained: calls.drained });
  let finish;
  const pending = new Promise((resolve, reject) => { finish = error => error ? reject(error) : resolve(); });
  const shutdown = () => { calls.shutdown++; };
  const Worker = { create: async options => {
    calls.options = options;
    if (creationFailure) throw new Error('synthetic creation failure');
    return { shutdown, run: async () => {
      for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, shutdown);
      try { if (runFailure) throw new Error('synthetic run failure'); await pending; }
      finally { calls.drained = true; for (const signal of ['SIGINT', 'SIGTERM']) process.off(signal, shutdown); }
    } };
  } };
  const code = readFileSync(processEnvBaseline() || path, 'utf8')
    .replace(/^import .*;\s*$/gm, '')
    .replace(/^const require = createRequire\(import\.meta\.url\);\s*$/m, '');
  const context = vm.createContext({ Worker, activities: {}, require: { resolve: name => name }, process, console: { error: (...args) => calls.logs.push(args) } });
  vm.runInContext(stripTypeScriptTypes(code), context);
  return { calls, process, finish };
}
function processEnvBaseline() { return process.env.COOKBOOK_R153_BASELINE; }
for (const stage of ['allocation', 'extraction']) {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    test(`${signal} during ${stage} does not exit before drain`, async () => {
      const f = fixture(); await flush();
      f.process.emit(signal); await flush();
      assert.equal(f.calls.shutdown, 1);
      assert.equal(f.calls.drained, false);
      assert.deepEqual(f.calls.exit, []);
      f.finish(); await flush();
      assert.equal(f.calls.drained, true);
      assert.deepEqual(f.calls.exit, []);
      assert.equal(f.process.listenerCount(signal), 0);
    });
  }
}
for (const option of ['creationFailure', 'runFailure']) {
  test(`${option} sets a failing exit status without immediate termination`, async () => {
    const f = fixture({ [option]: true }); await flush();
    assert.equal(f.process.exitCode, 1);
    assert.deepEqual(f.calls.exit, []);
    assert.equal(f.calls.logs.length, 1);
  });
}
test('worker shutdown is bounded independently from the signal handler', async () => {
  const f = fixture(); await flush();
  assert.equal(f.calls.options.shutdownGraceTime, '2 minutes');
  assert.equal(f.calls.options.shutdownForceTime, '3 minutes');
  f.finish(); await flush();
});
