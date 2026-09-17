const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const test = require('node:test');

const directory = path.resolve(__dirname, '..');

function loadAutomation() {
  let source = stripTypeScriptTypes(fs.readFileSync(path.join(directory, 'src/automation.ts'), 'utf8'));
  source = source.slice(source.indexOf('export class ProviderSearchAutomation'))
    .replace('export class', 'class') + '\nthis.ProviderSearchAutomation = ProviderSearchAutomation;';
  const identity = value => value;
  const context = {
    config: { automation: { maxRetries: 3 } },
    ProviderSearchResultSchema: {},
    console: { log() {}, warn() {}, error() {} },
    boxen: identity,
    chalk: {
      blue: identity, white: identity, gray: identity, yellow: identity,
      bold: { green: identity, yellow: identity, red: identity },
      green: { bold: identity },
    },
  };
  vm.runInNewContext(source, context);
  return new context.ProviderSearchAutomation();
}

test('validated direct provider data returns on the first extraction attempt', async () => {
  const automation = loadAutomation();
  const waits = [];
  const page = {
    async waitForLoadState() {},
    async waitForTimeout(ms) { waits.push(ms); },
  };
  let extracts = 0;
  automation.stagehand = {
    browser: { context: { async activePage() { return page; } } },
    async extract() {
      extracts++;
      return { data: { doctors: [{ name: 'Fixture Provider', specialty: 'Primary care' }] } };
    },
  };
  const doctors = await automation.extractDoctors();
  assert.equal(extracts, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(doctors)), [{ name: 'Fixture Provider', specialty: 'Primary care' }]);
  assert.deepEqual(waits, [5000]);
});

test('empty validated results use the configured bounded retry schedule', async () => {
  const automation = loadAutomation();
  const waits = [];
  const page = {
    async waitForLoadState() {},
    async waitForTimeout(ms) { waits.push(ms); },
  };
  let extracts = 0;
  automation.stagehand = {
    browser: { context: { async activePage() { return page; } } },
    async extract() { extracts++; return { data: { doctors: [] } }; },
  };
  await assert.rejects(automation.extractDoctors(), /No providers found after 3 extraction attempts/);
  assert.equal(extracts, 3);
  assert.deepEqual(waits, [5000, 2000, 4000]);
});

test('schema failures are contract errors and are not retried', async () => {
  const automation = loadAutomation();
  const page = { async waitForLoadState() {}, async waitForTimeout() {} };
  let extracts = 0;
  automation.stagehand = {
    browser: { context: { async activePage() { return page; } } },
    async extract() { extracts++; throw new Error('fixture schema mismatch'); },
  };
  await assert.rejects(automation.extractDoctors(), /incompatible data.*schema mismatch/);
  assert.equal(extracts, 1);
});

test('completion preserves the iframe and reset makes it reusable', () => {
  const html = fs.readFileSync(path.join(directory, 'public/index.html'), 'utf8');
  const source = html.slice(html.indexOf('function resetSessionView'), html.indexOf('// Start button handler'));
  const removed = [];
  const iframe = {
    style: {},
    src: 'https://fixture.invalid/session/one',
    removeAttribute(name) { if (name === 'src') this.src = ''; },
  };
  const heading = { textContent: 'Live Browser Session' };
  const results = [];
  const sessionView = {
    querySelectorAll() { return results; },
    querySelector(selector) { return selector === 'h2' ? heading : null; },
    insertBefore(node) { results.push(node); },
  };
  const elements = {
    'browserbase-iframe': iframe,
    'results-container': { style: {} },
    'doctors-list': { innerHTML: '' },
  };
  const document = {
    querySelector() { return sessionView; },
    getElementById(id) { return elements[id]; },
    createElement() { return { style: {}, appendChild() {}, className: '', innerHTML: '', textContent: '' }; },
  };
  for (const item of results) item.remove = () => removed.push(item);
  const context = { document };
  vm.runInNewContext(source, context);
  context.replaceIframeWithResults([{ name: 'Fixture Provider' }]);
  assert.equal(elements['browserbase-iframe'], iframe);
  assert.equal(iframe.style.display, 'none');
  results[0].remove = () => { results.splice(0, 1); };
  context.resetSessionView();
  assert.equal(elements['browserbase-iframe'], iframe);
  assert.equal(iframe.style.display, '');
  assert.equal(iframe.src, '');
  iframe.src = 'https://fixture.invalid/session/two';
  assert.equal(iframe.src.endsWith('/two'), true);
});
