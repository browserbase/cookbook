const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const source = fs.readFileSync(path.join(__dirname, '../src/main.ts'), 'utf8');
function helper(name, globals = {}) {
  const start = source.indexOf(`async function ${name}(`);
  assert(start >= 0);
  const end = source.indexOf('\nasync function ', start + 1);
  const code = stripTypeScriptTypes(source.slice(start, end < 0 ? undefined : end));
  return vm.runInNewContext(code + `; ${name}`, { toErrorMessage: e => e.message, ...globals });
}
const navigate = helper('gotoDocumentReady');
const installProbe = helper('installHillsboroughNetworkProbe');
const sdk = import('@browserbasehq/stagehand');

for (const fail of [false, true]) {
  test(`navigation uses the real v4 Page contract, failure=${fail}`, async () => {
    const { Page } = await sdk;
    assert.equal(Page.prototype.sendCDP, undefined);
    const calls = [];
    const page = new Page({ send: async (method, params) => {
      method.params.parse(params);
      calls.push(params);
      if (fail) throw new Error('synthetic navigation failure');
      return { page: { pageId: 'fixture' }, response: null };
    } }, { pageId: 'fixture' });
    const notes = [];
    assert.equal(await navigate(page, 'https://example.test/court', notes, 'fixture'), !fail);
    assert.equal(calls.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), { pageId: 'fixture', url: 'https://example.test/court', options: { waitUntil: 'domcontentloaded', timeout: 20000 } });
    assert.equal(notes.some(n => n.includes('completed')), !fail);
  });
}
for (const failRegistration of [false, true]) {
  test(`init script uses real v4 Page and still tries current document, failure=${failRegistration}`, async () => {
    const { Page } = await sdk;
    const calls = [];
    const page = new Page({ send: async (method, params) => {
      method.params.parse(params);
      calls.push(params);
      if ('source' in params && failRegistration) throw new Error('synthetic init failure');
      return { value: null };
    } }, { pageId: 'fixture' });
    const notes = [];
    await installProbe(page, notes);
    assert.equal(calls.length, 2);
    assert.equal(typeof calls[0].source, 'string');
    assert.equal(calls[1].expression, calls[0].source);
    assert.equal(notes.some(n => n.includes('registered for future')), !failRegistration);
    assert(notes.some(n => n.includes('installed on current document')));
  });
}

for (const hasBox of [false, true]) {
  test(`pointer motion uses actual Page hover/scroll schemas, controls=${hasBox}`, async () => {
    const { Page } = await sdk;
    const calls = [];
    const page = new Page({ send: async (method, params) => {
      method.params.parse(params);
      calls.push({ name: method.name, params });
      return {};
    } }, { pageId: 'fixture' });
    const move = helper('simulateHillsboroughHumanSignals', {
      selectorBox: async (_page, selector) => hasBox && selector === '#spFirstName' ? { x: 10, y: 10, width: 200, height: 100 } : null,
      env: { HILLSBOROUGH_PRE_SUBMIT_WAIT_MS: 0 },
      Math: { random: () => 0.5, max: Math.max, floor: Math.floor },
    });
    const notes = [];
    await move(page, notes);
    const hover = calls.filter(c => 'x' in c.params && !('deltaY' in c.params));
    const scroll = calls.filter(c => 'deltaY' in c.params);
    assert.equal(hover.length, hasBox ? 9 : 0);
    if (hasBox) {
      assert.equal(hover.at(-1).params.x, 110);
      assert.equal(hover.at(-1).params.y, 60);
    }
    assert.deepEqual(scroll.map(c => [c.params.x, c.params.y, c.params.deltaX, c.params.deltaY]), [[900, 700, 0, 180], [900, 700, 0, -120]]);
    assert(notes[0].includes(`across ${hasBox ? 1 : 0} control(s)`));
  });
}
