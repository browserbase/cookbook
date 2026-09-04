const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { stripTypeScriptTypes } = require('node:module');
const { z } = require('zod');

async function fixture(mode = '') {
  const calls = { connected: 0, stagehandClosed: 0, browserClosed: 0, released: 0, extracted: 0 };
  const browser = { sessionId: 'fixture-session', close: async () => { calls.browserClosed++; if (mode === 'browser-close' || mode === 'launch-close' || mode === 'launch-close-release') throw new Error('disconnect'); } };
  const stagehand = { browser, close: async () => { calls.stagehandClosed++; if (mode === 'stagehand-close') throw new Error('close'); }, extract: async (_, schema) => { calls.extracted++; if (mode === 'extract') throw new Error('extraction'); return { data: schema.parse({ name: 'Fixture' }) }; } };
  let workflow;
  const sdk = { browserbase: { connect: async () => { calls.connected++; return browser; }, launch: async () => browser }, Stagehand: { create: async () => { if (mode === 'init') throw new Error('init'); return stagehand; } } };
  const kit = { createTool: value => value, createAgent: value => value, createRoutingAgent: value => value, openai: value => value, State: class {}, createNetwork: () => ({ run: async () => { if (mode === 'network' || mode === 'network-release') throw new Error('network'); return 'answer'; } }) };
  const context = vm.createContext({ process: { env: { BROWSERBASE_PROJECT_ID: 'fixture-project' } }, console: { log() {} }, AggregateError, Error });
  const modules = new Map();
  function synthetic(id, exports) {
    if (!modules.has(id)) modules.set(id, new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }, { context, identifier: id }));
    return modules.get(id);
  }
  async function load(name) {
    if (modules.has(name)) return modules.get(name);
    const source = fs.readFileSync(path.join(__dirname, '../src', name), 'utf8');
    const mod = new vm.SourceTextModule(stripTypeScriptTypes(source), { context, identifier: name });
    modules.set(name, mod);
    await mod.link(async specifier => {
      if (specifier.startsWith('./')) return load(specifier.slice(2).replace(/\.js$/, '.ts'));
      if (specifier === 'zod') return synthetic(specifier, { z });
      if (specifier === '@browserbasehq/stagehand') return synthetic(specifier, sdk);
      if (specifier === '@inngest/agent-kit') return synthetic(specifier, kit);
      if (specifier === 'dotenv/config') return synthetic(specifier, {});
      if (specifier === '@inngest/agent-kit/server') return synthetic(specifier, { createServer: () => ({ listen() {} }) });
      if (specifier === 'inngest') return synthetic(specifier, { Inngest: class { createFunction(_, handler) { workflow = handler; return handler; } } });
      if (specifier === '@browserbasehq/sdk') return synthetic(specifier, { default: class { sessions = { update: async (id, options) => { assert.equal(id, 'fixture-session'); assert.equal(options.status, 'REQUEST_RELEASE'); calls.released++; if (mode === 'release' || mode === 'network-release' || mode === 'launch-close-release') throw new Error('release'); } }; } });
      throw new Error('Unexpected import ' + specifier);
    });
    return mod;
  }
  const utils = await load('utils.ts'); await utils.evaluate();
  const tools = await load('stagehand-tools.ts'); await tools.evaluate();
  const index = await load('index.ts'); await index.evaluate();
  const step = { run: async (_, handler) => handler() };
  return { calls, utils: utils.namespace, tools: tools.namespace, run: () => workflow({ step, event: { data: { input: 'fixture' } } }), extract: schema => tools.namespace.extract.handler({ instruction: 'fixture', schema }, { step, network: { state: { kv: new Map([['browserbaseSessionID', 'fixture-session']]) } } }) };
}

for (const schema of ['{}', '', 'name:string', '{name}', '{name:}', '{name:unknown}', '{name:string,name:number}', '{a b:string}', '{a: string,}', '{a:{b:string}}', '{__proto__:string}', '{x:string[][]}', '{x:string};run()']) {
  test('invalid schema allocates no handle: ' + schema, async () => {
    const f = await fixture();
    assert.throws(() => f.utils.stringToZodSchema(schema));
    assert.match(await f.extract(schema), /^Invalid extraction schema:/);
    assert.equal(f.calls.connected, 0); assert.equal(f.calls.extracted, 0);
  });
}

test('all supported scalars and arrays validate and serialize as JSON Schema', async () => {
  const f = await fixture();
  const schema = f.utils.stringToZodSchema('{name:string, age:number, ready:boolean, day:date, names:string[], ages:number[], flags:boolean[], days:date[]}');
  const value = { name: 'Fixture', age: 1, ready: true, day: '2024-02-29', names: ['A'], ages: [1], flags: [false], days: ['2024-02-29'] };
  assert.deepEqual(schema.parse(value), value);
  assert.equal(z.toJSONSchema(schema).properties.day.format, 'date');
  assert.equal(schema.safeParse({ ...value, day: '2024-02-30' }).success, false);
  assert.equal(schema.safeParse({ ...value, age: '1' }).success, false);
});

for (const mode of ['', 'extract', 'init', 'stagehand-close', 'browser-close']) {
  test('extract ownership: ' + (mode || 'success'), async () => {
    const f = await fixture(mode);
    if (['init', 'stagehand-close', 'browser-close'].includes(mode)) await assert.rejects(f.extract('{name:string}'));
    else if (mode === 'extract') assert.match(await f.extract('{name:string}'), /^Failed to extract/);
    else assert.equal((await f.extract('{name:string}')).name, 'Fixture');
    assert.equal(f.calls.browserClosed, 1);
    assert.equal(f.calls.stagehandClosed, mode === 'init' ? 0 : 1);
  });
}

for (const mode of ['', 'network', 'release', 'network-release']) {
  test('workflow release: ' + (mode || 'success'), async () => {
    const f = await fixture(mode);
    if (mode) await assert.rejects(f.run(), error => mode === 'network-release' ? error.errors.length === 2 : error.message === mode);
    else assert.equal((await f.run()).response, 'answer');
    assert.equal(f.calls.released, 1); assert.equal(f.calls.connected, 0);
  });
}

for (const mode of ['launch-close', 'launch-close-release']) {
  test('release after initial disconnect failure: ' + mode, async () => {
    const f = await fixture(mode);
    await assert.rejects(f.run(), error => mode === 'launch-close-release' ? error.errors.length === 2 : error.message === 'disconnect');
    assert.equal(f.calls.released, 1);
    assert.equal(f.calls.connected, 0);
  });
}
