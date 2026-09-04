import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const { z } = require(process.env.ZOD_MODULE_PATH || 'zod');
const root = new URL('../', import.meta.url);
const raw = readFileSync(new URL('mortgage-rates.js', root), 'utf8');
const source = raw.replace(/^import .*;\n/gm, '').replace('export async function', 'async function').replaceAll('import.meta.url', '"file:///synthetic/mortgage-rates.js"');
async function fixture(t, fail, env = { OPENAI_API_KEY: ' synthetic-key ' }) {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'cookbook-r194-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const events = [], result = { lenders: [{ name: 'Synthetic lender', rate: 'fixture only' }] };
  const page = { goto: async () => {}, waitForTimeout: async () => {}, evaluate: async () => {} };
  const browser = { close: async () => { events.push('browser.close'); } };
  const scope = vm.createContext({
    process: { env, argv: [] }, z, randomUUID, resolve: name => path.join(dir, name),
    writeFile: async (...args) => { if (fail === 'write') throw Error('synthetic write failure'); return fs.writeFile(...args); },
    rename: async (...args) => { if (fail === 'rename') throw Error('synthetic rename failure'); return fs.rename(...args); },
    rm: fs.rm, pathToFileURL: value => ({ href: 'file://' + value }),
    console: { log: message => events.push(message), error: message => events.push(message) },
    localBrowser: { launch: async () => { events.push('launch'); return browser; } },
    StagehandCreateOptionsSchema: { parse: value => value },
    Stagehand: { create: async options => {
      assert.equal(options.model.apiKey, 'synthetic-key');
      assert.equal(options.model.modelName, 'openai/gpt-4o');
      if (fail === 'initialize') throw Error('synthetic initialization failure');
      return {
        browser: { context: { activePage: async () => page } }, act: async () => ({ data: { success: true } }),
        extract: async (_instruction, schema) => { if (fail === 'extract') throw Error('synthetic extraction failure'); return { data: schema.parse(result) }; },
        close: async () => { events.push('stagehand.close'); if (fail === 'close') throw Error('synthetic cleanup failure'); },
      };
    } },
  });
  vm.runInContext(source + '\nglobalThis.main = main;', scope);
  return { scope, dir, events, result };
}

test('saves extraction JSON privately and closes both resources', async t => {
  const f = await fixture(t);
  await f.scope.main();
  const target = path.join(f.dir, 'mortgage-rates-results.json');
  assert.deepEqual(JSON.parse(await fs.readFile(target, 'utf8')), f.result);
  assert.equal((await fs.stat(target)).mode & 0o777, 0o600);
  assert.deepEqual(await fs.readdir(f.dir), ['mortgage-rates-results.json']);
  assert.deepEqual(f.events.slice(-2), ['stagehand.close', 'browser.close']);
});

test('missing model key fails before launch', async t => {
  const f = await fixture(t, undefined, { OPENAI_API_KEY: ' ' });
  await assert.rejects(f.scope.main(), /OPENAI_API_KEY/);
  assert.equal(f.events.length, 0);
});

for (const failure of ['initialize', 'extract', 'write', 'rename', 'close']) {
  test(`${failure} failure rejects and still closes allocated browser`, async t => {
    const f = await fixture(t, failure);
    const output = path.join(f.dir, 'mortgage-rates-results.json');
    await fs.writeFile(output, 'prior result');
    await assert.rejects(f.scope.main(), /synthetic/);
    assert.equal(f.events.at(-1), 'browser.close');
    if (failure !== 'close') {
      assert.equal(await fs.readFile(output, 'utf8'), 'prior result');
      assert.ok(!f.events.includes('Results saved to mortgage-rates-results.json'));
    }
    assert.deepEqual(await fs.readdir(f.dir), ['mortgage-rates-results.json']);
  });
}

test('actual CLI catch sets nonzero exit code without logging secret or extracted payload', async t => {
  const f = await fixture(t, undefined, {});
  f.scope.process.argv = ['node', '/synthetic/mortgage-rates.js'];
  vm.runInContext(source, f.scope);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.scope.process.exitCode, 1);
  assert.equal(f.events.length, 1);
  assert.match(f.events[0], /Mortgage scraper failed/);
});

test('documented start loads the copied environment file', () => {
  const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
  assert.equal(pkg.scripts.start, 'node --env-file=.env mortgage-rates.js');
});
