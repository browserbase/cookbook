const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const { test } = require('node:test');
const vm = require('node:vm');

const labels = ['first name', 'last name', 'company', 'job title', 'email', 'message'];
const values = ['Alex', 'Johnson', 'TechCorp Solutions', 'Software Developer', 'alex.johnson@example.com', "Hello, I'm interested in learning more about your services and would like to schedule a demo."];

async function run(change = {}) {
  const fields = labels.map((description, i) => ({ description, selector: '#field' + i, method: 'fill', arguments: [] }));
  change.fields?.(fields);
  const stored = new Map();
  const calls = []; const logs = []; const closed = [];
  const page = {
    goto: async () => {}, waitForTimeout: async () => {},
    locator(selector) { return {
      count: async () => change.duplicateLocator === selector ? 2 : 1,
      inputValue: async () => selector === '#help' ? (change.wrongHelp ? '' : stored.get(selector) || '') : (change.wrongValue === selector ? '' : stored.get(selector) || ''),
      innerText: async () => '',
    }; },
  };
  const browser = { context: { pages: async () => [page] }, close: async () => { closed.push('browser'); if (change.browserCloseFails) throw new Error('synthetic browser close'); } };
  const stagehand = {
    observe: async (instruction) => ({ data: instruction.includes('How Can') ? [{ selector: '#help', description: 'How Can We Help', method: 'click', arguments: [] }] : fields }),
    act: async (action, options) => {
      calls.push(action);
      if (change.failAt === calls.length) return { data: { success: false } };
      if (typeof action === 'object') stored.set(action.selector, action.arguments[0]);
      if (typeof action === 'string' && /demo option/i.test(action)) stored.set('#help', 'Demo');
      return { data: { success: true } };
    },
    close: async () => { closed.push('stagehand'); if (change.stagehandCloseFails) throw new Error('synthetic stagehand close'); },
  };
  const context = vm.createContext({ process: { env: { BROWSERBASE_API_KEY: 'synthetic' } }, console: { log: (...x) => logs.push(x.join(' ')), error: () => {}, warn: () => {} } });
  let source = readFileSync(require('node:path').join(__dirname, '../index.ts'), 'utf8');
  source = source.slice(0, source.lastIndexOf('main().catch')) + '\nexport { main };';
  const mod = new vm.SourceTextModule(stripTypeScriptTypes(source), { context });
  await mod.link(async (specifier) => {
    const exports = specifier === 'dotenv/config' ? {} : { browserbase: { launch: async () => browser }, Stagehand: { create: async () => { if (change.initFails) throw new Error('synthetic init'); return stagehand; } } };
    return new vm.SyntheticModule(Object.keys(exports), function () { for (const [k,v] of Object.entries(exports)) this.setExport(k,v); }, { context });
  });
  await mod.evaluate();
  let error; try { await mod.namespace.main(); } catch (e) { error = e; }
  return { error, calls, logs, closed, stored };
}

for (const [name, change] of [
  ['zero fields', { fields: f => f.splice(0) }],
  ['missing field', { fields: f => f.pop() }],
  ['duplicate semantic field', { fields: f => f.push({ ...f[0], selector: '#extra' }) }],
  ['ambiguous description', { fields: f => f[0].description = 'first name and last name' }],
  ['reused selector', { fields: f => f[1].selector = f[0].selector }],
  ['nonunique DOM field', { duplicateLocator: '#field2' }],
  ['failed fill action', { failAt: 1 }],
  ['failed dropdown action', { failAt: 7 }],
  ['failed option action', { failAt: 8 }],
  ['value did not persist', { wrongValue: '#field4' }],
  ['selection not confirmed', { wrongHelp: true }],
]) test(name, async () => {
  const r = await run(change);
  assert.ok(r.error, 'must fail an incomplete form');
  assert.equal(r.logs.some(x => x.includes('Form filled successfully')), false);
  assert.deepEqual(r.closed, ['stagehand', 'browser']);
  assert.ok(!r.calls.some(x => typeof x === 'string' && /submit/i.test(x)));
});

test('all six values and selected help option verified, with no submission', async () => {
  const r = await run();
  assert.equal(r.error, undefined);
  assert.deepEqual([...r.stored.values()], [...values, 'Demo']);
  assert.equal(r.logs.some(x => x.includes('Form filled successfully')), true);
  assert.deepEqual(r.closed, ['stagehand', 'browser']);
  assert.equal(r.calls.length, 8);
});

for (const change of [{ initFails: true }, { stagehandCloseFails: true }, { browserCloseFails: true }]) {
  test(`cleanup and final completion boundary ${JSON.stringify(change)}`, async () => {
    const r = await run(change);
    assert.ok(r.error);
    assert.deepEqual(r.closed, change.initFails ? ['browser'] : ['stagehand', 'browser']);
    assert.equal(r.logs.some(x => x.includes('Form filled successfully')), false);
  });
}
