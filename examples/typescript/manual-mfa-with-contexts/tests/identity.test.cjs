const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { z } = require('zod/v4');

async function fixture(mode) {
  const events = [], output = []; let launches = 0; let clock = 0;
  const sdk = { browserbase: { launch: async () => {
    launches++; events.push('launch');
    const page = { current: 'https://github.com/', goto: async url => { page.current = mode === 'redirect' && url.includes('settings') ? 'https://github.com/login' : url; }, url: async () => page.current.includes('settings') || mode === 'redirect' ? page.current : 'https://github.com/', locator: () => ({ fill: async () => {} }) };
    return { sessionId: 'owned-fixture', context: { pages: async () => [page] }, close: async () => { events.push('browser-close'); if (mode === 'browser-close') throw Error('close'); } };
  } }, Stagehand: { create: async ({ browser }) => {
    if (mode === 'init') throw Error('init');
    return { browser, act: async () => ({ data: { success: mode !== 'act' } }), extract: async prompt => prompt.startsWith('Is a') ? { data: ['mfa', 'timeout'].includes(mode) } : { data: { authenticated: mode !== 'false', username: mode === 'empty' || mode === 'reuse-empty' && launches === 2 ? '' : mode === 'wrong' ? 'other' : 'FixtureUser' } }, close: async () => { events.push('stagehand-close'); if (mode === 'stagehand-close') throw Error('close'); } };
  } } };
  const context = vm.createContext({ Date: mode === 'timeout' ? { now: () => clock += 121000 } : Date, process: { env: { GITHUB_USERNAME: 'fixtureuser', GITHUB_PASSWORD: 'fixture-password', BROWSERBASE_API_KEY: 'fixture-key' } }, URL, console: { log: (...args) => output.push(args.join(' ')) }, setTimeout: callback => { callback(); }, AggregateError });
  const synthetic = exports => new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }, { context });
  const source = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../index.ts'), 'utf8')).split('main().catch(')[0] + '\nexport {main};';
  const mod = new vm.SourceTextModule(source, { context });
  await mod.link(spec => {
    if (spec === 'dotenv/config') return synthetic({});
    if (spec === 'zod/v4') return synthetic({ z });
    if (spec === '@browserbasehq/stagehand') return synthetic(sdk);
    if (spec === '@browserbasehq/sdk') return synthetic({ Browserbase: class { contexts = { create: async () => { events.push('context-create'); return { id: 'fixture' }; }, delete: async () => { events.push('context-delete'); if (mode === 'delete') throw Error('delete'); } }; } });
    throw Error('Unexpected import');
  });
  await mod.evaluate(); return { run: mod.namespace.main, events, output };
}
for (const mode of ['ok', 'mfa', 'empty', 'wrong', 'false', 'redirect', 'reuse-empty', 'init', 'stagehand-close', 'browser-close', 'delete', 'act', 'timeout']) {
  test('actual MFA flow: ' + mode, async () => {
    const f = await fixture(mode);
    if (['ok', 'mfa'].includes(mode)) {
      await f.run();
      assert.deepEqual(f.events, ['context-create', 'launch', 'stagehand-close', 'browser-close', 'launch', 'stagehand-close', 'browser-close', 'context-delete']);
      assert(f.output.join('\n').includes('second session verified'));
      if (['mfa', 'timeout'].includes(mode)) assert(f.output.join('\n').includes('/sessions/owned-fixture'));
    } else {
      await assert.rejects(f.run());
      assert(f.events.includes('browser-close'));
      assert.equal(f.events.at(-1), 'context-delete');
      assert(!f.output.join('\n').includes('second session verified'));
    }
    assert(!f.output.join('\n').includes('fixture-password'));
    assert(!f.output.join('\n').includes('All future sessions'));
  });
}
