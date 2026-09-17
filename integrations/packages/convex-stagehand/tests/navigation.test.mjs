import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
function fixture({ navigationFailure = false, regionRetry = false } = {}) {
  const calls = [];
  const operation = name => async () => { calls.push(name); return { result: name === 'agent' ? { actions: [], completed: true, success: true } : name === 'observe' ? [] : { marker: 'synthetic', success: true, message: 'synthetic', actionDescription: 'synthetic' } }; };
  const context = vm.createContext({
    action: value => value, v: new Proxy({}, { get: () => () => ({}) }), sessionSettings: value => value, sessionSettingsValidator: {},
    internal: { metadata: { getSessionRegion: 'region', getSessionSettings: 'settings', upsertSessionMetadata: 'metadata' } },
    api: {
      startSession: async () => { calls.push('start'); return { sessionId: 'synthetic-new' }; },
      navigate: async (id, url, config, options, region) => { calls.push(['navigate', id, url, options, region]); if (navigationFailure) throw new Error('navigation failed'); if (regionRetry && region === 'us-west-2') throw new Error("Session is in region 'eu-central-1'"); },
      extract: operation('extract'), act: operation('act'), observe: operation('observe'), runBrowserTask: operation('agent'),
      endSession: async () => { calls.push('release'); },
    },
    ctx: { runQuery: async ref => ref === 'region' ? 'us-west-2' : null, runMutation: async () => {} },
  });
  const source = readFileSync(process.env.COOKBOOK_R163_BASELINE || new URL('../src/component/lib.ts', import.meta.url), 'utf8').replace(/^import .*;\s*$/gm, '').replace(/^export /gm, '');
  vm.runInContext(stripTypeScriptTypes(source), context);
  return { calls, run: (name, args) => vm.runInContext(`${name}.handler`, context)(context.ctx, { instruction: 'synthetic', action: 'synthetic', schema: {}, ...args }) };
}
for (const name of ['extract', 'act', 'observe', 'agent']) {
  test(`${name}: existing session navigates explicit URL before operation without release`, async () => { const f = fixture(); await f.run(name, { sessionId: 'existing', url: 'https://example.invalid/new', options: { waitUntil: 'domcontentloaded', timeout: 1234 } }); assert.equal(f.calls[0][0], 'navigate'); assert.equal(f.calls[0][1], 'existing'); assert.equal(f.calls[0][2], 'https://example.invalid/new'); assert.equal(f.calls[0][3].timeout, 1234); assert.equal(f.calls[1], name); assert.equal(f.calls.length, 2); });
  test(`${name}: existing session without URL preserves its page`, async () => { const f = fixture(); await f.run(name, { sessionId: 'existing' }); assert.deepEqual(f.calls, [name]); });
  test(`${name}: navigation failure prevents operation and preserves caller-owned session`, async () => { const f = fixture({ navigationFailure: true }); await assert.rejects(f.run(name, { sessionId: 'existing', url: 'https://example.invalid/new' }), /navigation failed/); assert.equal(f.calls.length, 1); assert.equal(f.calls[0][0], 'navigate'); });
  test(`${name}: owned session navigation failure releases allocated session`, async () => { const f = fixture({ navigationFailure: true }); await assert.rejects(f.run(name, { url: 'https://example.invalid/new' }), /navigation failed/); assert.equal(f.calls[0], 'start'); assert.equal(f.calls.at(-1), 'release'); assert.ok(!f.calls.includes(name)); });
  test(`${name}: region routing retries requested navigation before operation`, async () => { const f = fixture({ regionRetry: true }); await f.run(name, { sessionId: 'existing', url: 'https://example.invalid/new' }); assert.equal(f.calls.length, 3); assert.equal(f.calls[1][4], 'eu-central-1'); assert.equal(f.calls[2], name); });
}
