import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(process.env.COOKBOOK_CONVEX_RUNTIME
  ? `${process.env.COOKBOOK_CONVEX_RUNTIME}/package.json` : new URL('../package.json', import.meta.url));
const { convexTest } = await import(pathToFileURL(require.resolve('convex-test')));
const { internalMutationGeneric, internalQueryGeneric, defineSchema, defineTable, makeFunctionReference } = require('convex/server');
const { v } = require('convex/values');
const names = ['recordPendingCleanup', 'dueCleanup', 'claimCleanup', 'finishCleanup'];
function fixture() {
  let now = 1_000_000;
  const context = vm.createContext({ v, defineSchema, defineTable,
    internalMutation: internalMutationGeneric, internalQuery: internalQueryGeneric,
    Date: { now: () => now },
  });
  const evaluate = (file, suffix = '') => {
    const source = readFileSync(new URL(`../src/component/${file}`, import.meta.url), 'utf8')
      .replace(/^import .*;\s*$/gm, '').replace(/export default /g, 'globalThis.schema = ').replace(/^export /gm, '');
    vm.runInContext(stripTypeScriptTypes(source) + suffix, context);
  };
  evaluate('sessionSettings.ts');
  evaluate('schema.ts');
  evaluate('metadata.ts', `\nglobalThis.metadata = {${names.join(',')}};`);
  const t = convexTest(context.schema, {
    './_generated/server.ts': async () => ({}),
    './metadata.ts': async () => context.metadata,
  });
  const refs = Object.fromEntries(names.map(name => [name, makeFunctionReference(`metadata:${name}`)]));
  return { t, advance: ms => { now += ms; },
    record: args => t.mutation(refs.recordPendingCleanup, args),
    due: (projectId = 'project-a', limit = 10) => t.query(refs.dueCleanup, { projectId, limit }),
    claim: (token, projectId = 'project-a', sessionId = 'session-a') => t.mutation(refs.claimCleanup, { projectId, sessionId, token }),
    finish: (token, released, projectId = 'project-a', sessionId = 'session-a') => t.mutation(refs.finishCleanup, { projectId, sessionId, token, released }),
    rows: () => t.run(ctx => ctx.db.query('cleanupRequests').collect()),
  };
}
const seed = { sessionId: 'session-a', projectId: 'project-a', region: 'eu-central-1' };

test('queue persists across separate function calls and repeated records are idempotent', async () => {
  const f = fixture();
  await f.record(seed); await f.record(seed);
  assert.equal((await f.rows()).length, 1);
  assert.deepEqual(await f.due(), [{ sessionId: 'session-a', region: 'eu-central-1' }]);
  assert.equal(await f.claim('worker-a'), true);
  assert.equal(await f.finish('worker-a', true), true);
  await f.record(seed);
  assert.deepEqual(await f.due(), []);
  assert.equal((await f.rows())[0].state, 'release_requested');
});

test('concurrent workers claim one pending release exactly once', async () => {
  const f = fixture(); await f.record(seed);
  const claimed = await Promise.all([f.claim('worker-a'), f.claim('worker-b')]);
  assert.equal(claimed.filter(Boolean).length, 1);
  assert.deepEqual(await f.due(), []);
});

test('projects isolate records, queries, leases and completion', async () => {
  const f = fixture(); await f.record(seed); await f.record({ ...seed, projectId: 'project-b' });
  assert.equal(await f.claim('worker-a'), true);
  assert.equal((await f.due('project-b')).length, 1);
  assert.equal(await f.finish('worker-a', true, 'project-b'), false);
  assert.equal(await f.claim('worker-b', 'project-b'), true);
  assert.equal(await f.finish('worker-b', true, 'project-b'), true);
  assert.equal((await f.rows()).find(row => row.projectId === 'project-a').state, 'pending');
});

test('expired leases become due and old tokens cannot finish a reclaimed job', async () => {
  const f = fixture(); await f.record(seed); await f.claim('old-worker');
  f.advance(119_999); assert.deepEqual(await f.due(), []);
  assert.equal(await f.claim('new-worker'), false);
  f.advance(1); assert.equal((await f.due()).length, 1);
  assert.equal(await f.claim('new-worker'), true);
  assert.equal(await f.finish('old-worker', true), false);
  assert.equal(await f.finish('new-worker', true), true);
});

test('failed releases back off, preserve metadata, and can later complete', async () => {
  const f = fixture(); await f.record(seed); await f.claim('worker-a');
  assert.equal(await f.finish('worker-a', false), true);
  const row = (await f.rows())[0];
  assert.equal(row.state, 'pending'); assert.equal(row.attempts, 2);
  assert.equal(row.leaseToken, undefined); assert.equal(row.leaseExpiresAt, undefined);
  assert.deepEqual(await f.due(), []); assert.equal(await f.claim('worker-b'), false);
  f.advance(119_999); assert.deepEqual(await f.due(), []);
  f.advance(1); assert.equal(await f.claim('worker-b'), true);
  assert.equal(await f.finish('worker-b', true), true);
});

test('backoff is bounded after repeated failures', async () => {
  const f = fixture(); await f.record(seed);
  for (let i = 0; i < 12; i++) {
    assert.equal(await f.claim(`worker-${i}`), true);
    assert.equal(await f.finish(`worker-${i}`, false), true);
    const before = (await f.rows())[0];
    f.advance(3_600_000);
    assert.equal((await f.due()).length, 1);
    assert.ok(before.attempts >= 2);
  }
});

test('unknown and stale claims do not mutate existing jobs', async () => {
  const f = fixture(); await f.record(seed);
  assert.equal(await f.claim('worker', 'project-a', 'missing'), false);
  assert.equal(await f.finish('unknown', true), false);
  await f.claim('worker'); await f.finish('worker', true);
  assert.equal(await f.finish('worker', false), false);
  assert.equal(await f.claim('later'), false);
});

test('real argument validators reject credentials, malformed regions and invalid limits', async () => {
  const f = fixture();
  await assert.rejects(f.record({ ...seed, apiKey: 'synthetic-secret' }));
  await assert.rejects(f.record({ ...seed, region: 'unknown-region' }));
  for (const limit of [0, 101, 1.5]) await assert.rejects(f.due('project-a', limit));
  await f.record(seed);
  const keys = Object.keys((await f.rows())[0]).sort();
  assert.deepEqual(keys, ['_creationTime', '_id', 'attempts', 'nextAttemptAt', 'projectId', 'region', 'sessionId', 'state'].sort());
});

test('due query honors batch limit and optional region', async () => {
  const f = fixture();
  for (let i = 0; i < 4; i++) await f.record({ projectId: 'project-a', sessionId: `session-${i}` });
  assert.equal((await f.due('project-a', 2)).length, 2);
  assert.deepEqual((await f.due())[0], { sessionId: 'session-0' });
});
