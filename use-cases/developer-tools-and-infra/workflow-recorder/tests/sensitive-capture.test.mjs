import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const marker = 'synthetic-sensitive-value';
const recorder = await readFile(process.env.RECORDER_UNDER_TEST || new URL('../scripts/recorder.js', import.meta.url), 'utf8');
const inject = await readFile(process.env.INJECT_UNDER_TEST || new URL('../../../../qa-and-observability/browser-trace/record-and-fix/inject.js', import.meta.url), 'utf8');
function element(attributes) {
  return { nodeType: 1, tagName: 'INPUT', nodeName: 'INPUT', value: marker, id: marker, innerText: marker, textContent: marker, outerHTML: `<input value="${marker}">`, dataset: { value: marker }, parentElement: null, previousElementSibling: null,
    getAttribute: name => attributes[name] || null, hasAttribute: name => name in attributes };
}
for (const attributes of [{ type: 'password' }, { type: 'text', autocomplete: 'one-time-code' }, { type: 'text', 'data-private': '' }, { type: 'text', name: 'api_key' }]) {
  test(`cookbook_example masks sensitive input before console emission: ${JSON.stringify(attributes)}`, () => {
    const events = [];
    const window = {}; window.top = window;
    const context = vm.createContext({ window, location: { href: 'https://synthetic.invalid/form' }, console: { log: message => events.push(message), warn() {} }, pickSelectors: () => [], getPosition: () => ({}), accessibleName: () => marker });
    const body = recorder.slice(0, recorder.indexOf('  // ── Wire up')) + 'window.testInput = emitInput; })();';
    vm.runInContext(body, context);
    window.testInput(element(attributes));
    assert.equal(events.length, 1);
    assert.ok(!JSON.stringify(events).includes(marker));
    assert.equal(JSON.parse(events[0].slice(5)).secret, true);
  });
  test(`browser trace masks value and element metadata before buffering: ${JSON.stringify(attributes)}`, () => {
    const listeners = {}; const stored = new Map();
    const window = { addEventListener() {} };
    vm.runInNewContext(inject, { window, document: { addEventListener: (name, fn) => listeners[name] = fn }, location: { href: 'https://synthetic.invalid/form' }, localStorage: { getItem: () => null, setItem: (key, value) => stored.set(key, value) }, CSS: { escape: x => x }, setTimeout, clearTimeout });
    listeners.change({ target: element(attributes) });
    listeners.click({ target: element(attributes) });
    assert.equal(window.__rr_events.length, 2);
    assert.ok(window.__rr_events.every(event => event.secret && event.value === null));
    assert.ok(!JSON.stringify(window.__rr_events).includes(marker));
    assert.ok(![...stored.values()].join('').includes(marker));
  });
}

for (const inMemory of [false, true]) {
  test(`browser trace removes identified legacy secret buffer data from ${inMemory ? 'memory' : 'storage'}`, () => {
    const old = [{ type: 'change', value: marker, name: marker, el: { attrs: { type: 'password', value: marker }, html: marker }, selectors: [[marker]] }];
    const stored = new Map();
    const window = { addEventListener() {}, ...(inMemory ? { __rr_events: old } : {}) };
    vm.runInNewContext(inject, { window, document: { addEventListener() {} }, localStorage: { getItem: () => JSON.stringify(old), setItem: (key, value) => stored.set(key, value) } });
    assert.equal(window.__rr_events[0].type, 'redacted');
    assert.ok(!JSON.stringify(window.__rr_events).includes(marker));
    assert.ok(![...stored.values()].join('').includes(marker));
  });
}

for (const values of [['alpha', 'beta'], ['alpha,beta']]) {
  test(`cookbook_example capture preserves multi-select boundaries: ${JSON.stringify(values)}`, () => {
    const events = [];
    const window = {}; window.top = window;
    const context = vm.createContext({ window, document: { querySelector() { return null; } }, CSS: { escape: value => value }, location: { href: 'https://synthetic.invalid/form' }, console: { log: message => events.push(message), warn() {} } });
    const body = recorder.slice(0, recorder.indexOf('  // ── Wire up')) + 'window.testInput = emitInput; })();';
    vm.runInContext(body, context);
    const el = element({});
    el.tagName = 'SELECT'; el.nodeName = 'SELECT'; el.multiple = true;
    el.selectedOptions = values.map(value => ({ value }));
    window.testInput(el);
    const event = JSON.parse(events[0].slice(5));
    assert.equal(event.multiple, true);
    assert.deepEqual(Array.from(event.value), values);
  });
}
