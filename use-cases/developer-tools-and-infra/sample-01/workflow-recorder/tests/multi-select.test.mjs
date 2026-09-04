import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { parseArgs } from 'node:util';

const scripts = fileURLToPath(new URL('../scripts/', import.meta.url));
async function build(value) {
  const root = await mkdtemp(path.join(tmpdir(), 'sample_org-multiple-'));
  const op = { op: 'select', index: 0, tag: 'select', type: 'select-multiple', multiple: true, label: 'Regions', value, selectors: [{ kind: 'css', value: '#regions' }] };
  await writeFile(path.join(root, 'trace.json'), JSON.stringify({ ops: [op] }));
  const run = name => execFileSync(process.execPath, [path.join(scripts, name), path.basename(root), '--runs-root', path.dirname(root), '--no-llm'], { stdio: 'pipe' });
  run('detect-parameters.mjs'); run('emit-script.mjs');
  const manifest = JSON.parse(await readFile(path.join(root, 'parameters.manifest.json'), 'utf8'));
  const source = await readFile(path.join(root, 'stagehand/run.ts'), 'utf8');
  return { root, manifest, source };
}

for (const value of [['alpha', 'beta'], ['alpha,beta']]) {
  test(`multiple selection preserves boundaries for ${JSON.stringify(value)}`, async () => {
    const built = await build(value);
    try {
      assert.equal(built.manifest.parameters[0].type, 'string[]');
      assert.deepEqual(built.manifest.parameters[0].original_value, value);
      stripTypeScriptTypes(built.source);
      const calls = [];
      const browser = { context: { activePage: async () => ({}) }, close: async () => {} };
      const stagehand = { browser, act: async action => calls.push(action.arguments), close: async () => {} };
      const context = vm.createContext({ process: { env: {} }, localBrowser: { launch: async () => browser }, Stagehand: { create: async () => stagehand } });
      const body = built.source.slice(built.source.indexOf('export async function run'), built.source.indexOf('\nif (import.meta.url')).replace('export ', '');
      vm.runInContext(stripTypeScriptTypes(body), context);
      await context.run({ regions: value });
      assert.deepEqual(calls, [value]);
      assert.ok(built.source.includes(JSON.stringify(JSON.stringify(value))));
    } finally { await rm(built.root, { recursive: true, force: true }); }
  });
}

test('multiple selection rejects scalar programmatic input before allocation', async () => {
  const built = await build(['alpha', 'beta']);
  try {
    let launches = 0;
    const context = vm.createContext({ process: { env: {} }, localBrowser: { launch: async () => { launches++; } }, Stagehand: {} });
    const body = built.source.slice(built.source.indexOf('export async function run'), built.source.indexOf('\nif (import.meta.url')).replace('export ', '');
    vm.runInContext(stripTypeScriptTypes(body), context);
    await assert.rejects(context.run({ regions: 'alpha,beta' }), /array of strings/);
    assert.equal(launches, 0);
  } finally { await rm(built.root, { recursive: true, force: true }); }
});

test('CLI accepts a JSON array and rejects ambiguous comma-separated input', async () => {
  const built = await build(['alpha', 'beta']);
  try {
    const execute = async args => {
      const calls = [];
      const browser = { context: { activePage: async () => ({}) }, close: async () => {} };
      const stagehand = { browser, act: async action => calls.push(action.arguments), close: async () => {} };
      const context = vm.createContext({
        process: { env: {}, argv: ['node', 'run.ts'], exit: () => { throw new Error('CLI rejected input'); } },
        console: { log() {}, error() {} },
        parseArgs: options => parseArgs({ ...options, args }),
        localBrowser: { launch: async () => browser }, Stagehand: { create: async () => stagehand },
      });
      const body = built.source.slice(built.source.indexOf('export async function run'), built.source.indexOf('\nif (import.meta.url')).replace('export ', '');
      vm.runInContext(stripTypeScriptTypes(body), context);
      const cli = built.source.slice(built.source.indexOf('  const { values } = parseArgs'), built.source.lastIndexOf('}'));
      await vm.runInContext(stripTypeScriptTypes(cli), context);
      return calls;
    };
    assert.equal(JSON.stringify(await execute(['--regions', '["alpha,beta","gamma"]'])), JSON.stringify([['alpha,beta', 'gamma']]));
    await assert.rejects(execute(['--regions', 'alpha,beta']));
  } finally { await rm(built.root, { recursive: true, force: true }); }
});
