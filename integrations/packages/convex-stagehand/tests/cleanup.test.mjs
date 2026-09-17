import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
const { ConvexError, convexToJson } = await import(process.env.COOKBOOK_CONVEX_VALUES_MODULE);
function fixture({ releaseFailure = false, operationFailure = false, recordFailure = false, finishFailure = false, due = [] } = {}) {
 const events = [], records = [];
 const operation = name => async () => { events.push(name); if (operationFailure) throw new Error('synthetic operation failure'); return { result: name === 'agent' ? { actions: [], completed: true, success: true } : name === 'observe' ? [{ selector: '#fixture', description: 'fixture' }] : { marker: 'fixture', success: true, message: 'fixture', actionDescription: 'fixture' } }; };
 const refs = new Proxy({}, { get: (_, key) => key });
 const ctx = {
  runQuery: async (ref, args) => { if (ref === 'dueCleanup') { records.push([ref, args]); return due; } return ref === 'getSessionRegion' ? 'us-west-2' : null; },
  runMutation: async (ref, args) => { records.push([ref, args]); if (ref === 'recordPendingCleanup' && recordFailure) throw Error('database unavailable'); if (ref === 'finishCleanup' && finishFailure) throw Error('database unavailable'); return ref === 'claimCleanup' || ref === 'finishCleanup' ? true : null; },
 };
 const context = vm.createContext({
  ConvexError, randomUUID, convexToJson, action: value => value, v: new Proxy({}, { get: () => () => ({}) }), sessionSettings: value => value, sessionSettingsValidator: {},
  internal: { metadata: refs }, api: {
   startSession: async () => ({ sessionId: 'owned-fixture', projectId: 'project-fixture' }), resolveProjectId: async () => 'project-fixture', navigate: async () => {},
   extract: operation('extract'), act: operation('act'), observe: operation('observe'), runBrowserTask: operation('agent'),
   endSession: async () => { events.push('release'); if (releaseFailure) throw Error('secret provider detail'); },
  },
 });
 const source = readFileSync(new URL('../src/component/lib.ts', import.meta.url), 'utf8').replace(/^import .*;\s*$/gm, '').replace(/^export default .*;$/gm, '').replace(/^export /gm, '');
 vm.runInContext(stripTypeScriptTypes(source), context);
 return { events, records, run: (name, args = {}) => vm.runInContext(`${name}.handler`, context)(ctx, { browserbaseApiKey: 'synthetic-secret', modelApiKey: 'synthetic-model-secret', instruction: 'fixture', action: 'fixture', schema: {}, url: 'https://example.invalid', ...args }) };
}
for (const name of ['extract', 'act', 'observe', 'agent']) {
 test(`${name}: owned release failure preserves successful result and queues retry once`, async () => {
  const f = fixture({ releaseFailure: true }); await assert.rejects(f.run(name), error => { assert.ok(error instanceof ConvexError); assert.equal(error.data.code, 'SESSION_CLEANUP_FAILED'); assert.equal(error.data.sessionId, 'owned-fixture'); assert.equal(error.data.operationSucceeded, true); assert.equal(error.data.cleanupState, 'pending'); assert.ok(error.data.result); assert.doesNotThrow(() => convexToJson(error.data)); assert.ok(!JSON.stringify(error.data).includes('secret')); return true; }); assert.equal(f.events.filter(x => x === 'release').length, 1); const queued = f.records.filter(x => x[0] === 'recordPendingCleanup'); assert.equal(queued.length, 1); assert.equal(queued[0][1].projectId, 'project-fixture'); assert.ok(!JSON.stringify(queued).includes('secret'));
 });
 test(`${name}: failed operation and failed cleanup have no fabricated result`, async () => { const f = fixture({ releaseFailure: true, operationFailure: true }); await assert.rejects(f.run(name), error => { assert.equal(error.data.operationSucceeded, false); assert.equal(error.data.result, undefined); assert.equal(error.data.cleanupState, 'pending'); return true; }); assert.equal(f.events.filter(x => x === 'release').length, 1); });
 test(`${name}: recording failure reports unrecorded with session ID`, async () => { const f = fixture({ releaseFailure: true, recordFailure: true }); await assert.rejects(f.run(name), error => error.data.cleanupState === 'unrecorded' && error.data.sessionId === 'owned-fixture'); });
 test(`${name}: caller-owned sessions are neither released nor queued`, async () => { const f = fixture({ releaseFailure: true }); await f.run(name, { sessionId: 'borrowed' }); assert.ok(!f.events.includes('release')); assert.ok(!f.records.some(x => x[0] === 'recordPendingCleanup')); });
}
test('reconcile uses caller project and credentials without persisting secrets', async () => { const f = fixture({ due: [{ sessionId: 'owned-fixture', region: 'us-west-2' }] }); const r = await f.run('reconcileCleanup', { limit: 3 }); assert.equal(r.attempted, 1); assert.equal(r.releaseRequested, 1); assert.equal(r.pending, 0); assert.ok(f.records.some(x => x[0] === 'claimCleanup')); assert.ok(f.records.some(x => x[0] === 'finishCleanup' && x[1].released)); assert.ok(!JSON.stringify(f.records).includes('secret')); });
test('reconcile release failure remains pending', async () => { const f = fixture({ releaseFailure: true, due: [{ sessionId: 'owned-fixture' }] }); const r = await f.run('reconcileCleanup'); assert.equal(r.pending, 1); assert.equal(r.releaseRequested, 0); });
test('client unwrap helper recognizes structured failure and reconciliation forwards no model key', async () => {
 const source = readFileSync(new URL('../src/client/index.ts', import.meta.url), 'utf8').replace(/^import[\s\S]*?;\s*$/gm, '').replace(/^export default .*;$/gm, '').replace(/^export /gm, '');
 const context = vm.createContext({ ConvexError });
 vm.runInContext(stripTypeScriptTypes(source, { mode: 'transform' }) + '\nglobalThis.Client = Stagehand;', context);
 const data = { code: 'SESSION_CLEANUP_FAILED', sessionId: 'fixture', cleanupState: 'pending', operationSucceeded: true, result: { marker: 'fixture' } };
 assert.equal(context.getSessionCleanupFailure(new ConvexError(data)).result.marker, 'fixture');
 assert.equal(context.getSessionCleanupFailure(new Error('other')), null);
 assert.equal(context.getSessionCleanupFailure(new ConvexError({ ...data, cleanupState: 'invented' })), null);
 const client = new context.Client({ lib: { reconcileCleanup: 'retry-ref' } }, { browserbaseApiKey: 'fixture-key', modelApiKey: 'must-not-forward' });
 let sent; const result = await client.reconcileCleanup({ runAction: async (ref, args) => { sent = { ref, args }; return { attempted: 1, releaseRequested: 1, pending: 0, unrecorded: 0 }; } }, { limit: 2 });
 assert.equal(sent.ref, 'retry-ref'); assert.equal(sent.args.limit, 2); assert.equal(sent.args.browserbaseProjectId, undefined); assert.equal(sent.args.modelApiKey, undefined); assert.equal(result.releaseRequested, 1);
});
test('reconciliation bookkeeping failure is reported after accepted release', async () => { const f = fixture({ finishFailure: true, due: [{ sessionId: 'owned-fixture' }] }); const r = await f.run('reconcileCleanup'); assert.equal(r.releaseRequested, 1); assert.equal(r.unrecorded, 1); });
