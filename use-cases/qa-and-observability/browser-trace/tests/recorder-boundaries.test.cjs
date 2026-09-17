const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const base = path.join(__dirname, '..', 'record-and-fix');
const serverSource = fs.readFileSync(path.join(base, 'server.mjs'), 'utf8');
const shellSource = fs.readFileSync(path.join(base, 'shell.html'), 'utf8');
const injectSource = fs.readFileSync(path.join(base, 'inject.js'), 'utf8');

function recorderFixture(page) {
  const start = serverSource.indexOf('let events = []');
  const middle = serverSource.indexOf('// turn raw browser events', start);
  const finish = serverSource.indexOf('async function beginRecording()');
  const end = serverSource.indexOf('\nconst server =', finish);
  const sandbox = {
    context: { pages: () => [page] },
    setInterval(fn) { sandbox.poll = fn; },
    buildTimeline() { return sandbox.fixtureEvents().map((event) => ({ text: event.type })); },
    resolveCode() { return null; },
    APP_URL: null,
  };
  vm.createContext(sandbox);
  vm.runInContext(`${serverSource.slice(start, middle)}\n${serverSource.slice(finish, end)}\n` +
    `globalThis.fixture={beginRecording,finishRecording,fixtureEvents:()=>events,fixtureRecording:()=>recording};`, sandbox);
  sandbox.fixtureEvents = sandbox.fixture.fixtureEvents;
  return sandbox;
}

test('start discards acknowledged leftovers and stop atomically drains the final interaction', async () => {
  const buffers = [[{ id: 'old:1', type: 'click' }], [{ id: 'run:1', type: 'click' }], []];
  const page = { evaluate: async () => buffers.shift() || [] };
  const f = recorderFixture(page);
  await f.fixture.beginRecording();
  const bundle = await f.fixture.finishRecording();
  assert.equal(bundle.actions, 1);
  assert.equal(f.fixture.fixtureEvents()[0].id, 'run:1');
  await f.fixture.beginRecording();
  assert.deepEqual(Array.from(f.fixture.fixtureEvents()), []);
});

test('stop joins queued polls and de-duplicates stable event identities', async () => {
  let release;
  let calls = 0;
  const page = { evaluate: async () => {
    calls += 1;
    if (calls === 1) return [];
    if (calls === 2) return new Promise((resolve) => { release = () => resolve([{ id: 'run:1', type: 'click' }]); });
    if (calls === 3) return [{ id: 'run:2', type: 'change' }, { id: 'run:1', type: 'click' }];
    return [];
  } };
  const f = recorderFixture(page);
  await f.fixture.beginRecording();
  f.poll();
  f.poll();
  await Promise.resolve();
  const stopping = f.fixture.finishRecording();
  release();
  const bundle = await stopping;
  assert.equal(bundle.actions, 2);
});

function storageFixture() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}
function injectedRealm(storage) {
  const listeners = {};
  class Element {}
  const window = { addEventListener() {}, localStorage: storage };
  const document = { addEventListener: (type, fn) => { listeners[type] = fn; }, getElementById: () => null };
  const sandbox = { window, localStorage: storage, document, Element, CSS: { escape: String }, crypto: { randomUUID: () => 'realm' },
    location: { href: 'https://example.test/a' }, getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
    setTimeout: () => 1, clearTimeout() {}, Date };
  vm.runInNewContext(injectSource, sandbox);
  return { window, listeners, Element };
}

test('draining acknowledges persistent events so navigation cannot restore them', () => {
  const storage = storageFixture();
  const first = injectedRealm(storage);
  const button = new first.Element();
  Object.assign(button, { nodeType: 1, tagName: 'BUTTON', nodeName: 'BUTTON', innerText: 'Save', textContent: 'Save',
    parentElement: null, previousElementSibling: null, dataset: {}, outerHTML: '<button>Save</button>',
    getAttribute: () => '', hasAttribute: () => false, getBoundingClientRect: () => ({}) });
  first.listeners.click({ target: button });
  const [event] = first.window.__rr_drain();
  assert.equal(event.id, 'realm:realm:1');
  const second = injectedRealm(storage);
  assert.deepEqual(Array.from(second.window.__rr_events), []);
});

test('source mapping returns only token-anchored context and labels its evidence', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-source-'));
  fs.writeFileSync(path.join(root, 'checkout.tsx'), 'const unrelated = true;\nfunction saveOrder() {}\n<button data-action="save-order" onClick={saveOrder}>Save</button>\n');
  const start = serverSource.indexOf('function findFile(');
  const end = serverSource.indexOf('\n// read a JSON POST body', start);
  const sandbox = { REPO_ROOT: root, readFileSync: fs.readFileSync, readdirSync: fs.readdirSync, URL };
  vm.createContext(sandbox);
  vm.runInContext(`${serverSource.slice(start, end)}\nglobalThis.resolve=resolveCode`, sandbox);
  assert.equal(sandbox.resolve('https://app.test/checkout', [{ name: 'missing' }]), null);
  const match = sandbox.resolve('https://app.test/checkout', [{ el: { data: { action: 'save-order' } } }]);
  assert.equal(match.match, 'element token + nearby handler');
  assert.equal(match.handler, 'saveOrder');
  assert.equal(match.matchedToken, 'save-order');
});

test('access control requires the owner cookie and exact same origin', async () => {
  const { createAccessControl } = await import('../record-and-fix/access.mjs');
  const access = createAccessControl({ token: 'synthetic-token', host: '127.0.0.1', port: 4321 });
  assert.equal(access.authorized({ headers: {} }), false);
  assert.equal(access.authorized({ headers: { cookie: 'browser_trace_owner=wrong' } }), false);
  assert.equal(access.authorized({ headers: { cookie: 'browser_trace_owner=%zz' } }), false);
  assert.equal(access.authorized({ headers: { cookie: 'x=1; browser_trace_owner=synthetic-token' } }), true);
  assert.equal(access.sameOrigin({ headers: { origin: 'http://127.0.0.1:4321' } }), true);
  assert.equal(access.sameOrigin({ headers: { origin: 'https://attacker.test' } }), false);
  assert.match(access.ownerCookie, /HttpOnly; SameSite=Strict/);
  assert.match(serverSource, /server\.listen\(PORT, HOST\)/);
  for (const route of ['record/start', 'record/stop', 'fix', 'reload', 'seed', 'reset']) {
    assert.match(serverSource, new RegExp(`api/${route.replace('/', '\\/')}[\\s\\S]{0,160}requireMethod\\(req, res, 'POST'\\)`));
  }
});

function element() {
  return { classList: { add() {}, remove() {} }, style: {}, addEventListener() {}, appendChild() {}, remove() {},
    textContent: '', innerHTML: '', value: '', disabled: false, scrollTop: 0 };
}
function shellFixture(fetchImpl, mediaDevices = { getUserMedia: async () => { throw new Error('denied'); } }, MediaRecorder = class {}) {
  const elements = new Map();
  const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, createElement: element };
  const script = shellSource.slice(shellSource.lastIndexOf('<script>') + 8, shellSource.lastIndexOf('</script>'));
  const sandbox = { document, navigator: { mediaDevices }, MediaRecorder, fetch: fetchImpl, Blob,
    location: { reload() {} }, setTimeout(fn) { fn(); return 1; }, clearTimeout() {}, Date, encodeURIComponent };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);
  return { sandbox, elements, action: elements.get('action') };
}
const response = (status, payload) => ({ ok: status >= 200 && status < 300, status, json: async () => payload });
async function settle() { await Promise.resolve(); await Promise.resolve(); await new Promise((resolve) => setImmediate(resolve)); }

test('HTTP failures restore retry controls and a failed fix is never reported complete', async () => {
  let stopFails = true;
  let fixFails = true;
  const fetchImpl = async (url) => {
    if (url === '/api/config') return response(200, { recordOnly: false, appName: 'Fixture' });
    if (url === '/api/live') return response(200, { liveUrl: 'https://live.test' });
    if (url === '/api/record/start') return response(200, { ok: true });
    if (url === '/api/record/stop') {
      if (stopFails) return response(500, { error: 'stop unavailable' });
      return response(200, { timeline: [], elements: [], actions: 0, notes: 0, voiceText: '', noteText: '', code: null });
    }
    if (url === '/api/fix') return fixFails ? response(500, { error: 'fix unavailable' }) : response(200, { ok: true });
    throw new Error(`unexpected ${url}`);
  };
  const f = shellFixture(fetchImpl);
  await settle();
  await f.action.onclick();
  await f.action.onclick();
  assert.equal(f.action.disabled, false);
  assert.equal(f.action.textContent, 'Retry finishing');
  stopFails = false;
  await f.action.onclick();
  assert.equal(f.action.textContent, 'Retry loading fixed preview');
  assert.equal(f.action.disabled, false);
  fixFails = false;
  await f.action.onclick();
  assert.equal(f.action.textContent, '↺ Reset demo');
});

test('Done cancels delayed microphone acquisition and stops its tracks before returning', async () => {
  let grant;
  let starts = 0;
  let stops = 0;
  const stream = { getTracks: () => [{ stop: () => { stops += 1; } }] };
  class Recorder { constructor(s) { this.stream = s; this.state = 'inactive'; } start() { starts += 1; this.state = 'recording'; } }
  const mediaDevices = { getUserMedia: () => new Promise((resolve) => { grant = () => resolve(stream); }) };
  const f = shellFixture(async (url) => url === '/api/config' ? response(200, { recordOnly: true }) : response(200, { liveUrl: 'https://live.test', ok: true }), mediaDevices, Recorder);
  await settle();
  await f.action.onclick();
  const done = f.action.onclick();
  grant();
  await done;
  assert.equal(starts, 0);
  assert.equal(stops, 1);
});
