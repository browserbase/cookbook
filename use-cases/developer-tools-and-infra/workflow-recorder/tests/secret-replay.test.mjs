import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { enrichmentCandidates, recorderEvents } from '../scripts/secret-inputs.mjs';
const scripts = fileURLToPath(new URL('../scripts/', import.meta.url));
const secret = { index: 0, op: 'fill', secret: true, type: 'password', label: 'Sensitive field', value: null, selectors: [{ kind: 'css', value: 'input:nth-of-type(1)' }] };
async function fixture(op, action) {
  const root = await mkdtemp(path.join(tmpdir(), 'cookbook_example-secret-'));
  try {
    await writeFile(path.join(root, 'trace.json'), JSON.stringify({ ops: [op] }));
    const run = name => execFileSync(process.execPath, [path.join(scripts, name), path.basename(root), '--runs-root', path.dirname(root), '--no-llm'], { encoding: 'utf8', stdio: 'pipe' });
    await action(root, run);
  } finally { await rm(root, { recursive: true, force: true }); }
}
test('secret placeholder bypasses manifest and uses runtime environment before allocation', async () => fixture(secret, async (root, run) => {
  run('detect-parameters.mjs');
  const manifest = JSON.parse(await readFile(path.join(root, 'parameters.manifest.json'), 'utf8'));
  assert.deepEqual(manifest.parameters, []);
  run('emit-script.mjs');
  const source = await readFile(path.join(root, 'stagehand/run.ts'), 'utf8');
  stripTypeScriptTypes(source);
  let launches = 0; const values = [];
  const browser = { context: { activePage: async () => ({}) }, close: async () => {} };
  const stagehand = { browser, act: async action => values.push(action.arguments[0]), close: async () => {} };
  const env = {};
  const context = vm.createContext({ process: { env }, localBrowser: { launch: async () => { launches++; return browser; } }, Stagehand: { create: async () => stagehand } });
  const body = source.slice(source.indexOf('export async function run'), source.indexOf('\nif (import.meta.url')).replace('export ', '');
  vm.runInContext(stripTypeScriptTypes(body), context);
  await assert.rejects(context.run({}), /Set WORKFLOW_SECRET_0/);
  assert.equal(launches, 0);
  env.WORKFLOW_SECRET_0 = 'synthetic-runtime-secret';
  await context.run({});
  assert.deepEqual(values, ['synthetic-runtime-secret']);
  assert.ok(!source.includes(env.WORKFLOW_SECRET_0));
}));
test('legacy password values fail before inference or script generation without echoing them', async () => fixture({ ...secret, secret: undefined, value: 'synthetic-legacy-secret' }, async (root, run) => {
  await writeFile(path.join(root, 'parameters.manifest.json'), JSON.stringify({ parameters: [] }));
  for (const script of ['detect-parameters.mjs', 'emit-script.mjs']) {
    assert.throws(() => run(script), error => {
      assert.ok(!String(error.stderr).includes('synthetic-legacy-secret'));
      return String(error.stderr).includes('Unsafe legacy sensitive operation');
    });
  }
}));
test('old secret manifest entry is removed by detection and rejected by direct emission', async () => fixture(secret, async (root, run) => {
  await writeFile(path.join(root, 'parameters.manifest.json'), JSON.stringify({ parameters: [{ name: 'password', type: 'string', is_variable: true, source_op_indices: [0], original_value: 'synthetic-old-secret' }] }));
  assert.throws(() => run('emit-script.mjs'), /Secret inputs cannot appear/);
  const output = run('detect-parameters.mjs');
  const manifest = await readFile(path.join(root, 'parameters.manifest.json'), 'utf8');
  assert.ok(!(output + manifest).includes('synthetic-old-secret'));
  assert.deepEqual(JSON.parse(manifest).parameters, []);
}));

test('model payload builder excludes secret candidates and retains ordinary candidates', () => {
  const candidates = [
    { ...secret, original_value: 'must-not-leave-process' },
    { label: 'Search', tag: 'input', type: 'text', original_value: 'browser automation', pattern: null },
  ];
  const payload = enrichmentCandidates(candidates);
  assert.equal(payload.length, 1);
  assert.equal(payload[0].value_example, 'browser automation');
  assert.ok(!JSON.stringify(payload).includes('must-not-leave-process'));
});

test('raw recording boundary persists only normalized recorder events', () => {
  const ordinary = { op: 'click', label: 'Next', op_index: 1 };
  const secretEvent = { ...secret, index: undefined, op_index: 2 };
  const message = { method: 'Runtime.consoleAPICalled', params: { timestamp: 3, executionContextId: 4, args: [
    { type: 'string', value: '[REC]' + JSON.stringify(ordinary) },
    { type: 'string', value: '[REC]' + JSON.stringify(secretEvent) },
    { type: 'string', value: 'page console data' },
  ] } };
  const output = recorderEvents(message);
  assert.equal(output.length, 2);
  assert.ok(!JSON.stringify(output).includes('page console data'));
  const normalized = JSON.parse(output[1].params.args[0].value.slice(5));
  assert.deepEqual(normalized, { op: 'fill', op_index: 2, secret: true, type: 'password', label: 'Sensitive field', value: null, selectors: secret.selectors });
});

test('raw recording boundary rejects unsafe secret payloads and ignores other CDP traffic', () => {
  assert.deepEqual(recorderEvents({ method: 'Network.responseReceived', params: { body: 'private page data' } }), []);
  assert.throws(() => recorderEvents({ method: 'Runtime.consoleAPICalled', params: { args: [{ type: 'string', value: '[REC]' + JSON.stringify({ ...secret, index: undefined, op_index: 0, value: 'unsafe' }) }] } }), /Unsafe legacy/);
});
