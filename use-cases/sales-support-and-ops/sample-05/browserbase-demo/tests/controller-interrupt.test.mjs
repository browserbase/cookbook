import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
const raw = readFileSync(process.env.CONTROLLER_SOURCE || new URL('../lib/demo-controller.ts', import.meta.url), 'utf8');
const between = (start, end) => raw.slice(raw.indexOf(start), raw.indexOf(end, raw.indexOf(start)));
const legacy = raw.includes('function areInstructionsSimilar')
  ? between('const SIMILAR_INSTRUCTION_OVERLAP_THRESHOLD', 'type BrowserPageSummary')
    + between('function normalizeInstructionText', 'function hasDirectNavigationIntent') : '';
const code = legacy + between('async function abortActiveRun', 'function markRunComplete')
  + between('function queueFollowUpInstruction', 'async function runInstructionLoop')
  + between('async function executeInstruction', 'export function getDemoSnapshot');
function fixture(busy = true) {
  let aborted = 0, runs = 0;
  const session = { busy, lastInstruction: 'click submit button', pendingQueue: [], mutationLock: Promise.resolve(),
    acceptedRequests: new Map(), abortController: new AbortController(), activeRun: Promise.resolve() };
  session.abortController.signal.addEventListener('abort', () => aborted++);
  const scope = vm.createContext({ AbortController, crypto: { randomUUID },
    getOrCreateSession: () => session, toSnapshot: s => ({ outcome: s.lastControlOutcome }),
    setControlOutcome: (s, outcome) => { s.lastControlOutcome = outcome; }, pushEvent() {}, publishSession() {},
    getMissingConfig: () => [], runInstructionLoop: () => { runs++; return new Promise(() => {}); } });
  vm.runInContext(stripTypeScriptTypes(code) + '\nglobalThis.execute = executeInstruction;globalThis.replace = queueReplacementInstruction;', scope);
  return { session, execute: (input, queued) => scope.execute({ demoId: 'synthetic', ...input }, queued),
    replace: input => scope.replace(session, input), aborted: () => aborted, runs: () => runs };
}
test('corrective explicit interrupt replaces work and aborts despite overlapping words', async () => {
  const f = fixture();
  await f.execute({ instruction: 'do not click submit button', interrupt: true });
  assert.equal(f.aborted(), 1);
  assert.equal(f.session.pendingQueue[0].instruction, 'do not click submit button');
  assert.equal(f.session.lastControlOutcome, 'interrupting');
});
test('replacement helper also honors an interrupt matching current text', () => {
  const f = fixture(); f.replace({ instruction: 'click submit button', interrupt: true });
  assert.equal(f.aborted(), 1); assert.equal(f.session.pendingQueue.length, 1);
});
test('changed or repeated text without a request ID is not semantic proof of a duplicate', async () => {
  const f = fixture();
  for (const instruction of ['do not click submit button', 'click submit button', 'click submit button']) await f.execute({ instruction });
  assert.equal(f.session.pendingQueue.length, 3); assert.equal(f.aborted(), 0);
});
test('retry of one interrupt ID does not replace a newer correction', async () => {
  const f = fixture();
  const old = { requestId: 'a', instruction: 'do not click submit button', interrupt: true };
  await f.execute(old); await f.execute({ requestId: 'b', instruction: 'click cancel button', interrupt: true });
  await f.execute(old);
  assert.equal(f.session.pendingQueue[0].instruction, 'click cancel button');
  assert.equal(f.session.lastControlOutcome, 'duplicate_ignored');
});
test('reusing an ID with different contents rejects without changing the queue', async () => {
  const f = fixture(); await f.execute({ requestId: 'a', instruction: 'first task' });
  await assert.rejects(f.execute({ requestId: 'a', instruction: 'do not do first task', interrupt: true }), /different instruction/);
  assert.equal(f.session.pendingQueue.length, 1); assert.equal(f.aborted(), 0);
});
test('simultaneous delivery of one ID queues only once under actual mutation lock', async () => {
  const f = fixture(); const input = { requestId: 'a', instruction: 'next task' };
  await Promise.all([f.execute(input), f.execute(input)]); assert.equal(f.session.pendingQueue.length, 1);
});
test('accepted queued request still starts through the internal queue dispatch path', async () => {
  const f = fixture(); await f.execute({ requestId: 'a', instruction: 'next task' });
  const queued = f.session.pendingQueue.shift(); f.session.busy = false;
  await f.execute(queued, true); assert.equal(f.runs(), 1);
  await f.execute({ requestId: 'a', instruction: 'next task' }); assert.equal(f.runs(), 1);
});
test('new IDs permit intentional repeats after a completed run', async () => {
  const f = fixture(false); await f.execute({ requestId: 'a', instruction: 'click submit button' });
  f.session.busy = false; await f.execute({ requestId: 'b', instruction: 'click submit button' });
  assert.equal(f.runs(), 2);
});

test('actual control route preserves request identity and rejects malformed IDs', async () => {
  const require = createRequire(import.meta.url);
  const { z } = require(process.env.ZOD_MODULE_PATH || 'zod');
  const route = readFileSync(new URL('../app/api/demo/control/route.ts', import.meta.url), 'utf8')
    .replace(/^import .*;$/gm, '').replace(/export /g, '');
  let received;
  const scope = vm.createContext({ z, NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) },
    runDemoInstruction: async input => { received = input; return { accepted: true }; } });
  vm.runInContext(stripTypeScriptTypes(route) + '\nglobalThis.post = POST;', scope);
  const requestId = randomUUID(), demoId = randomUUID();
  assert.equal((await scope.post({ json: async () => ({ requestId, demoId, instruction: 'do not click', interrupt: true }) })).status, 200);
  assert.equal(received.requestId, requestId);
  received = undefined;
  assert.equal((await scope.post({ json: async () => ({ requestId: 'invalid', demoId, instruction: 'click' }) })).status, 500);
  assert.equal(received, undefined);
});
