import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const root = new URL('../src/', import.meta.url);
const allocationId = '12345678-1234-4123-8123-123456789abc';
const intent = { allocationId, projectId: 'project-fixture', extensionId: 'extension-fixture' };
const session = (status = 'RUNNING', id = 'session-fixture') => ({ id, status, projectId: intent.projectId, userMetadata: { allocation_id: allocationId } });
function load(name, globals) {
  const backup = process.env.COOKBOOK_R152_BASELINE;
  let source = readFileSync(backup ? `${backup}-${name === 'workflows.ts' ? 'workflows' : 'activities'}.ts` : new URL(name, root), 'utf8');
  source = source.replace(/^import[\s\S]*?;\s*$/gm, '').replace(/^export /gm, '');
  const context = vm.createContext({ console: { log() {}, warn() {}, error() {} }, ...globals });
  vm.runInContext(stripTypeScriptTypes(source), context);
  return context;
}
function fixture({ rows = [session()], createError, releaseError } = {}) {
  const calls = { create: [], list: [], release: [], options: [] };
  class Browserbase {
    constructor(options) {
      calls.options.push(options);
      this.sessions = {
        create: async (...args) => { calls.create.push(args); if (createError) throw createError; return session(); },
        list: async (...args) => { calls.list.push(args); return rows; },
        update: async (...args) => { calls.release.push(args); if (releaseError) throw releaseError; return {}; },
      };
    }
  }
  const ApplicationFailure = { nonRetryable(message) { return Object.assign(new Error(message), { nonRetryable: true }); } };
  const context = load('research-activities.ts', { Browserbase, ApplicationFailure, process: { env: { BROWSERBASE_API_KEY: 'fixture', BROWSERBASE_PROJECT_ID: intent.projectId } }, Math: { random: () => 1 }, crypto: { randomUUID: () => allocationId } });
  return { context, calls };
}
test('initialization records durable intent and makes one non-retried creation', async () => {
  const { context, calls } = fixture();
  const result = await context.initializeBrowser(intent);
  assert.equal(result.browserbaseSessionId, 'session-fixture');
  assert.equal(calls.create.length, 1);
  const [body, options] = calls.create[0];
  assert.equal(body.userMetadata.allocation_id, allocationId);
  assert.equal(body.extensionId, intent.extensionId);
  assert.equal(body.projectId, intent.projectId);
  assert.equal(body.keepAlive, true);
  assert.ok(body.api_timeout >= 60 && body.api_timeout <= 21600);
  assert.equal(options?.maxRetries ?? calls.options[0].maxRetries, 0);
});
test('lost create response reconciles the original allocation', async () => {
  const { context, calls } = fixture({ createError: new Error('response lost') });
  await assert.rejects(context.initializeBrowser(intent));
  const recovered = await context.reconcileBrowser(intent);
  assert.equal(recovered.browserbaseSessionId, 'session-fixture');
  assert.equal(calls.create.length, 1);
  assert.equal(calls.list[0][0].q, `user_metadata['allocation_id']:'${allocationId}'`);
});
for (const rows of [[], [session('PENDING')]]) {
  test(`reconciliation never creates when results are ${rows.length ? 'pending' : 'absent'}`, async () => {
    const { context, calls } = fixture({ rows });
    await assert.rejects(context.reconcileBrowser(intent));
    await assert.rejects(context.reconcileBrowser(intent));
    assert.equal(calls.create.length, 0);
  });
}
test('terminal allocation is not replaced', async () => {
  const { context, calls } = fixture({ rows: [session('COMPLETED')] });
  await assert.rejects(context.reconcileBrowser(intent));
  assert.equal(calls.create.length, 0);
});
test('duplicate owned allocations are released independently and not adopted', async () => {
  const { context, calls } = fixture({ rows: [session(), session('RUNNING', 'session-second')] });
  await assert.rejects(context.reconcileBrowser(intent));
  assert.deepEqual(calls.release.map(x => x[0]).sort(), ['session-fixture', 'session-second']);
  assert.equal(calls.create.length, 0);
});
for (const override of [{ projectId: 'other-project' }, { userMetadata: { allocation_id: 'other' } }]) {
  test(`mismatched ownership is neither adopted nor released ${JSON.stringify(override)}`, async () => {
    const { context, calls } = fixture({ rows: [{ ...session(), ...override }] });
    await assert.rejects(context.reconcileBrowser(intent));
    assert.equal(calls.release.length, 0);
    assert.equal(calls.create.length, 0);
  });
}
test('duplicate cleanup attempts every owned session even when one release fails', async () => {
  const { context, calls } = fixture({ rows: [session(), session('PENDING', 'session-second')], releaseError: new Error('release failed') });
  await assert.rejects(context.reconcileBrowser(intent), error => !error.nonRetryable);
  assert.equal(calls.release.length, 2);
});
test('invalid intent cannot allocate or query', async () => {
  for (const invalid of [{ ...intent, allocationId: "bad'query" }, { ...intent, extensionId: '' }, { ...intent, projectId: 'other' }]) {
    const { context, calls } = fixture();
    await assert.rejects(context.initializeBrowser(invalid));
    await assert.rejects(context.reconcileBrowser(invalid));
    assert.equal(calls.create.length + calls.list.length, 0);
  }
});
test('a fresh worker can reconcile delayed visibility without creating', async () => {
  const first = fixture({ rows: [] });
  await assert.rejects(first.context.reconcileBrowser(intent));
  const next = fixture();
  assert.equal((await next.context.reconcileBrowser(intent)).browserbaseSessionId, 'session-fixture');
  assert.equal(first.calls.create.length + next.calls.create.length, 0);
});
function workflowFixture({ lostAck = false, reconciliationFails = false, cleanupFails = false, downstreamFails = false } = {}) {
  const calls = { allocate: 0, reconcile: 0, cleanup: [], identities: [], policies: [], scopes: 0 };
  const identity = { browserbaseSessionId: 'session-fixture', attemptId: allocationId, projectId: intent.projectId };
  const functions = {
    prepareBrowserExtension: async () => ({ projectId: intent.projectId, extensionId: intent.extensionId }),
    initializeBrowser: async value => { calls.allocate++; calls.identities.push(value); if (lostAck) throw new Error('activity response lost after allocation'); return identity; },
    reconcileBrowser: async value => { calls.reconcile++; calls.identities.push(value); if (reconciliationFails) throw new Error('not visible within retry window'); return identity; },
    navigateToSearchPage: async value => { assert.equal(value, identity); if (downstreamFails) throw new Error('navigation failed'); },
    executeSearch: async value => { assert.equal(value, identity); },
    extractSearchResults: async value => { assert.equal(value, identity); return [{ title: 'fixture', snippet: 'fixture' }]; },
    formatResults: async () => 'fixture results',
    cleanupBrowser: async value => { calls.cleanup.push(value); if (cleanupFails) throw new Error('cleanup failed'); },
  };
  const context = load('workflows.ts', {
    workflowInfo: () => ({ workflowId: 'fixture-workflow' }), uuid4: () => allocationId,
    CancellationScope: { nonCancellable: async fn => { calls.scopes++; return fn(); } },
    proxyActivities: options => new Proxy({}, { get: (_, name) => { calls.policies.push([name, options]); return functions[name]; } }),
  });
  return { context, calls };
}
test('workflow recovers lost acknowledgement with the persisted intent and never reallocates', async () => {
  const { context, calls } = workflowFixture({ lostAck: true });
  assert.equal(await context.searchWithRetry('fixture'), 'fixture results');
  assert.equal(calls.allocate, 1); assert.equal(calls.reconcile, 1); assert.equal(calls.cleanup.length, 1);
  assert.deepEqual(calls.identities[0], calls.identities[1]);
  assert.equal(calls.policies.find(([name]) => name === 'initializeBrowser')[1].retry.maximumAttempts, 1);
  assert.ok(calls.policies.find(([name]) => name === 'reconcileBrowser')[1].scheduleToCloseTimeout);
  assert.equal(calls.scopes, 2);
});
test('workflow does not reallocate after exhausted reconciliation', async () => {
  const { context, calls } = workflowFixture({ lostAck: true, reconciliationFails: true });
  await assert.rejects(context.searchWithRetry('fixture'));
  assert.equal(calls.allocate, 1); assert.equal(calls.reconcile, 1); assert.equal(calls.cleanup.length, 0);
});
test('downstream failure releases the recorded session', async () => {
  const { context, calls } = workflowFixture({ downstreamFails: true });
  await assert.rejects(context.searchWithRetry('fixture'));
  assert.equal(calls.cleanup.length, 1);
});
test('cleanup failure prevents workflow success', async () => {
  const { context, calls } = workflowFixture({ cleanupFails: true });
  await assert.rejects(context.searchWithRetry('fixture'), /cleanup failed/);
  assert.equal(calls.cleanup.length, 1);
});
