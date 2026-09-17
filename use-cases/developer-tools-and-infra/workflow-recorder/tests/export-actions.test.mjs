import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { parseArgs } from 'node:util';

const emitter = process.env.EMITTER_UNDER_TEST || fileURLToPath(new URL('../scripts/emit-script.mjs', import.meta.url));
async function replay(ops, parameters = [], params = {}, cli = null, expectedType = "boolean") {
  const root = await mkdtemp(path.join(tmpdir(), 'cookbook_example-actions-'));
  try {
    await writeFile(path.join(root, 'trace.json'), JSON.stringify({ ops }));
    await writeFile(path.join(root, 'parameters.manifest.json'), JSON.stringify({ parameters }));
    if (parameters === null) {
      const detector = fileURLToPath(new URL('../scripts/detect-parameters.mjs', import.meta.url));
      execFileSync(process.execPath, [detector, path.basename(root), '--runs-root', path.dirname(root), '--no-llm'], { stdio: 'pipe' });
      const detected = JSON.parse(await readFile(path.join(root, 'parameters.manifest.json'), 'utf8'));
      assert.equal(detected.parameters[0].type, expectedType);
    }
    execFileSync(process.execPath, [emitter, path.basename(root), '--runs-root', path.dirname(root)], { stdio: 'pipe' });
    const source = await readFile(path.join(root, 'stagehand/run.ts'), 'utf8');
    const body = source.slice(source.indexOf('export async function run'), source.indexOf('\nif (import.meta.url')).replace('export ', '');
    const calls = [];
    const page = {
      mouse: { click: async (x, y) => calls.push(['mouse', x, y]) },
      keyboard: { press: async key => calls.push(['press', key]) },
    };
    const browser = { context: { activePage: async () => page }, close: async () => {} };
    const stagehand = { browser, act: async action => calls.push([action.method, action.selector, ...(action.arguments || [])]), close: async () => {} };
    const context = vm.createContext({ process: { env: {} }, localBrowser: { launch: async () => browser }, Stagehand: { create: async () => stagehand } });
    vm.runInContext(stripTypeScriptTypes(body), context);
    if (cli) {
      context.parseArgs = options => parseArgs({ ...options, args: cli });
      context.console = { error() {}, log() {} };
      context.process.exit = () => { throw new Error('CLI rejected input'); };
      const cliSource = source.slice(source.indexOf('  const { values } = parseArgs'), source.lastIndexOf('}'));
      await vm.runInContext(stripTypeScriptTypes(cliSource), context);
    } else {
      await context.run(params);
    }
    return calls;
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('repeated Next clicks remain two distinct replay actions', async () => {
  const click = { op: 'click', label: 'Next', selectors: [{ kind: 'css', value: '#next' }] };
  assert.deepEqual(await replay([{ ...click, index: 0 }, { ...click, index: 1 }]), [['click', '#next'], ['click', '#next']]);
});
test('repeated coordinate clicks remain distinct', async () => {
  const click = { op: 'click', label: 'increment', position: { center: { x: 20, y: 30 } } };
  assert.deepEqual(await replay([{ ...click, index: 0 }, { ...click, index: 1 }]), [['mouse', 20, 30], ['mouse', 20, 30]]);
});
test('repeated key presses remain distinct', async () => {
  assert.deepEqual(await replay([{ op: 'press', key: 'ArrowDown', index: 0 }, { op: 'press', key: 'ArrowDown', index: 1 }]), [['press', 'ArrowDown'], ['press', 'ArrowDown']]);
});

const checkbox = { op: 'check', index: 0, label: 'Include', value: 'true', selectors: [{ kind: 'css', value: '#include' }] };
const flag = { name: 'include', type: 'boolean', is_variable: true, source_op_indices: [0], original_value: 'true' };
for (const value of [true, false]) {
  test(`checkbox uses runtime parameter ${value} regardless of recording`, async () => {
    for (const recorded of ['true', 'false']) {
      assert.deepEqual(await replay([{ ...checkbox, value: recorded }], [flag], { include: value }), [[value ? 'check' : 'uncheck', '#include']]);
    }
  });
  test(`CLI checkbox accepts explicit ${value}`, async () => {
    assert.deepEqual(await replay([checkbox], [flag], {}, ['--include', String(value)]), [[value ? 'check' : 'uncheck', '#include']]);
  });
}
test('literal checkbox retains recorded boolean state', async () => {
  for (const value of [true, false, 'true', 'false']) {
    assert.deepEqual(await replay([{ ...checkbox, value }]), [[value === true || value === 'true' ? 'check' : 'uncheck', '#include']]);
  }
});
test('runtime checkbox rejects missing or non-boolean values', async () => {
  for (const value of [undefined, null, 'false', 0]) {
    await assert.rejects(replay([checkbox], [flag], { include: value }), /must be a boolean/);
  }
});
test('CLI rejects misspelled boolean values instead of silently unchecking', async () => {
  await assert.rejects(replay([checkbox], [flag], {}, ['--include', 'flase']), /must be true or false/);
});

test('heuristic checkbox detection feeds a working boolean replay parameter', async () => {
  assert.deepEqual(await replay([checkbox], null, { include: false }), [['uncheck', '#include']]);
});
test('CLI uses the recorded boolean default when no override is given', async () => {
  assert.deepEqual(await replay([checkbox], [flag], {}, []), [['check', '#include']]);
});
test('invalid literal or manifest checkbox type fails during export', async () => {
  await assert.rejects(replay([{ ...checkbox, value: 'maybe' }]));
  await assert.rejects(replay([checkbox], [{ ...flag, type: 'string' }], { include: 'false' }));
});

for (const value of ['00123', '01', '123', '12345678901234567890', '12.00', '$12.00']) {
  test(`text-field default preserves ${value} through detection and CLI replay`, async () => {
    const op = { op: 'fill', index: 0, label: 'Account ID', tag: 'input', type: 'text', value, selectors: [{ kind: 'css', value: '#account' }] };
    assert.deepEqual(await replay([op], null, {}, [], 'string'), [['fill', '#account', value]]);
  });
}
test('explicit numeric field retains numeric inference for a lossless number', async () => {
  const op = { op: 'fill', index: 0, label: 'Quantity', type: 'number', value: '12', selectors: [{ kind: 'css', value: '#quantity' }] };
  assert.deepEqual(await replay([op], null, {}, [], 'number'), [['fill', '#quantity', '12']]);
});
test('numeric-looking identifier with a number input still preserves leading zeros', async () => {
  const op = { op: 'fill', index: 0, label: 'Account ID', type: 'number', value: '00123', selectors: [{ kind: 'css', value: '#account' }] };
  assert.deepEqual(await replay([op], null, {}, [], 'string'), [['fill', '#account', '00123']]);
});
