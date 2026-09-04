import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { parseArgs } from 'node:util';
import vm from 'node:vm';
const scripts = process.env.SCRIPTS_UNDER_TEST || fileURLToPath(new URL('../scripts/', import.meta.url));
const ops = ['Name', 'Name', '2FA code'].map((label, index) => ({ op: 'fill', index, label, value: `value-${index}`, selectors: [{ kind: 'css', value: `#field-${index}` }] }));
async function fixture(callback) {
  const root = await mkdtemp(path.join(tmpdir(), 'sample_org-names-'));
  try {
    await writeFile(path.join(root, 'trace.json'), JSON.stringify({ ops }));
    const run = script => execFileSync(process.execPath, [path.join(scripts, script), path.basename(root), '--runs-root', path.dirname(root), '--no-llm'], { stdio: 'pipe' });
    await callback(root, run);
  } finally { await rm(root, { recursive: true, force: true }); }
}
async function emittedCalls(root, run) {
  run('emit-script.mjs');
  const source = await readFile(path.join(root, 'stagehand/run.ts'), 'utf8');
  // Parse the complete emitted TypeScript, including type and CLI declarations.
  stripTypeScriptTypes(source);
  const body = source.slice(source.indexOf('export async function run'), source.indexOf('\nif (import.meta.url')).replace('export ', '');
  const calls = [];
  const browser = { context: { activePage: async () => ({}) }, close: async () => {} };
  const stagehand = { browser, close: async () => {}, act: async action => calls.push([action.selector, ...action.arguments]) };
  const context = vm.createContext({ process: { env: {}, exit: () => { throw new Error('unexpected CLI error'); } }, console, parseArgs: options => parseArgs({ ...options, args: [] }), localBrowser: { launch: async () => browser }, Stagehand: { create: async () => stagehand } });
  vm.runInContext(stripTypeScriptTypes(body), context);
  await vm.runInContext(stripTypeScriptTypes(source.slice(source.indexOf('  const { values } = parseArgs'), source.lastIndexOf('}'))), context);
  assert.deepEqual(calls, ops.map(op => [op.selectors[0].value, op.value]));
}
test('ordinary duplicate and digit-leading labels generate valid independent parameters', async () => fixture(async (root, run) => {
  run('detect-parameters.mjs');
  const manifest = JSON.parse(await readFile(path.join(root, 'parameters.manifest.json'), 'utf8'));
  assert.deepEqual(manifest.parameters.map(p => p.name), ['name', 'name_2', 'param_2_fa_code']);
  await emittedCalls(root, run);
}));
test('human edits are normalized and made unique on redetection', async () => fixture(async (root, run) => {
  run('detect-parameters.mjs');
  const file = path.join(root, 'parameters.manifest.json');
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  manifest.parameters.forEach((p, i) => p.name = ['Same Name', 'same-name', '__proto__'][i]);
  await writeFile(file, JSON.stringify(manifest));
  run('detect-parameters.mjs');
  const fixed = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(new Set(fixed.parameters.map(p => p.name)).size, 3);
  assert.ok(fixed.parameters.every(p => /^[a-z][a-z0-9_]*$/.test(p.name) && p.name !== '__proto__'));
  await emittedCalls(root, run);
  run('detect-parameters.mjs');
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')).parameters.map(p => p.name), fixed.parameters.map(p => p.name));
}));
for (const names of [['name', 'name', 'code'], ['foo-bar', 'foo_bar', 'code'], ['good', '2fa', 'code'], ['__proto__', 'other', 'code']]) {
  test(`direct emission rejects unsafe or colliding manifest names: ${names.join(', ')}`, async () => fixture(async (root, run) => {
    const parameters = ops.map((op, i) => ({ name: names[i], type: 'string', is_variable: true, source_op_indices: [op.index], original_value: op.value }));
    await writeFile(path.join(root, 'parameters.manifest.json'), JSON.stringify({ parameters }));
    assert.throws(() => run('emit-script.mjs'));
    await assert.rejects(access(path.join(root, 'stagehand/run.ts')));
  }));
}
