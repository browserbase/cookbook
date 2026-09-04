import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import test, { before, after } from 'node:test';
const { chromium } = await import(process.env.COOKBOOK_PLAYWRIGHT_MODULE);
let local;
before(async () => { local = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }); });
after(async () => { await local?.close(); });
const html = '<label for="w">Wages</label><input id="w"><label for="d">Dependents under age 17</label><input id="d">';
const actions = [
  { selector: '#w', method: 'fill', description: 'Fill applicant age', arguments: ['26'] },
  { selector: '#d', method: 'fill', description: 'Fill applicant age', arguments: ['26'] },
];
async function run({ markup = html, observed = actions, mode, cleanupFailure } = {}) {
  const context = await local.newContext(); const realPage = await context.newPage(); const calls = [];
  const page = { goto: async () => realPage.setContent(markup), evaluate: (...args) => realPage.evaluate(...args) };
  const browser = { context: { newPage: async () => page, pages: async () => [page] }, close: async () => { calls.push('browser-close'); if (cleanupFailure === 'browser') throw Error('private cleanup detail'); } };
  const stagehand = {
    observe: async (...args) => { calls.push(['observe', args]); return { data: observed }; },
    act: async (action, options) => {
      calls.push(['act', action, options]);
      if (mode === 'throw') throw Error('private action detail');
      if (mode === 'false') return { data: { success: false } };
      if (mode !== 'no-fill') await realPage.locator(action.selector).fill(action.arguments[0]);
      if (mode === 'mutate-earlier' && calls.filter(x => Array.isArray(x) && x[0] === 'act').length === 2) await realPage.locator('#w').fill('0');
      return { data: { success: true } };
    },
    close: async () => { calls.push('stagehand-close'); if (cleanupFailure === 'stagehand') throw Error('private cleanup detail'); },
  };
  const source = readFileSync(process.env.COOKBOOK_R159_BASELINE || new URL('../app/api/form/route.ts', import.meta.url), 'utf8').replace(/^import .*;\s*$/gm, '').replace(/^export /gm, '');
  const sandbox = vm.createContext({ browserbase: { launch: async () => browser }, Stagehand: { create: async () => stagehand }, NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) }, process: { env: { BROWSERBASE_API_KEY: 'synthetic', BROWSERBASE_PROJECT_ID: 'synthetic', OPENAI_API_KEY: 'synthetic' } }, console: { log() {}, error() {} } });
  vm.runInContext(stripTypeScriptTypes(source), sandbox);
  try { const response = await sandbox.GET(); const values = await realPage.locator('input').evaluateAll(nodes => nodes.map(n => n.value)); return { response, calls, values, page }; }
  finally { await context.close(); }
}
test('DOM labels override misleading age descriptions for wages and dependents', async () => {
  const r = await run(); assert.equal(r.response.status, 200); assert.deepEqual(r.values, ['54321', '1']); assert.equal(r.response.body.count, 2);
  for (const call of r.calls.filter(x => Array.isArray(x) && x[0] === 'act')) assert.equal(call[2].page, r.page);
});
for (const mode of ['false', 'throw', 'no-fill', 'mutate-earlier']) test(`failed or unverified action cannot report success: ${mode}`, async () => {
  const r = await run({ mode }); assert.equal(r.response.status, 500); assert.ok(!JSON.stringify(r.response).includes('private')); assert.ok(r.calls.includes('browser-close')); assert.ok(r.calls.includes('stagehand-close'));
});
for (const [name, markup, observed] of [
  ['ambiguous selector', '<label>Wages<input></label><label>Age<input></label>', [{ ...actions[0], selector: 'input' }]],
  ['conflicting labels', '<label for="w">Wages</label><label for="w">Age</label><input id="w">', [actions[0]]],
  ['duplicate target', html, [actions[0], actions[0]]],
  ['unmapped label', '<label for="w">Unrecognized field</label><input id="w">', [actions[0]]],
  ['non-fill action', html, [{ ...actions[0], method: 'click' }]],
  ['empty observation', html, []],
]) test(`does not fill ambiguous or unsupported input: ${name}`, async () => {
  const r = await run({ markup, observed }); assert.equal(r.response.status, 500); assert.equal(r.calls.filter(x => Array.isArray(x) && x[0] === 'act').length, 0);
});
test('XPath target supported with verified value', async () => {
  const r = await run({ observed: [{ ...actions[0], selector: 'xpath=//*[@id="w"]' }] }); assert.equal(r.response.status, 200); assert.equal(r.values[0], '54321');
});
for (const cleanupFailure of ['stagehand', 'browser']) test(`cleanup failure cannot report success: ${cleanupFailure}`, async () => {
  const r = await run({ cleanupFailure }); assert.equal(r.response.status, 500); assert.ok(r.calls.includes('stagehand-close')); assert.ok(r.calls.includes('browser-close')); assert.ok(!JSON.stringify(r.response).includes('private'));
});
for (const [label, expected] of [['Federal tax', '8345'], ['State tax', '2222'], ['Age', '26'], ['Dependents 17-23', '0']]) test(`exact label maps independently: ${label}`, async () => {
  const r = await run({ markup: `<label for="w">${label}</label><input id="w">`, observed: [actions[0]] }); assert.equal(r.response.status, 200); assert.equal(r.values[0], expected);
});
