const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
function source(file) { return stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/^import .*;\s*$/gm, '').replace('export default ', 'const configuration = ').replace(/^export /gm, '')); }
function fixture(page, close = async () => {}) {
 let spec; const ctx = vm.createContext({ task: value => { spec = value; return value; }, puppeteer: { launch: async () => ({ newPage: async () => page, close }) } });
 vm.runInContext(source('src/trigger/with-browser.ts') + source('src/trigger/puppeteer-log-page-title.tsx'), ctx); return () => spec.run({});
}
test('missing or malformed project ref fails before constructing configuration', () => { for (const ref of [undefined, '', 'wrong']) { let configured = false; const ctx = vm.createContext({ process: { env: { TRIGGER_PROJECT_REF: ref } }, defineConfig: () => { configured = true; }, aptGet() {}, puppeteer() {} }); assert.throws(() => vm.runInContext(source('trigger.config.ts'), ctx)); assert.equal(configured, false); } });
test('project config uses caller project and explicit task directory', () => { let config; const ctx = vm.createContext({ process: { env: { TRIGGER_PROJECT_REF: 'proj_fixture' } }, defineConfig: value => { config = value; }, aptGet() {}, puppeteer() {} }); vm.runInContext(source('trigger.config.ts'), ctx); assert.equal(config.project, 'proj_fixture'); assert.deepEqual(Array.from(config.dirs), ['./src/trigger']); });
test('incorrect browser title fails and closes browser', async () => { let closed = false; const run = fixture({ setContent: async () => {}, title: async () => 'Wrong' }, async () => { closed = true; }); await assert.rejects(run(), /title/); assert.equal(closed, true); });
test('actual local Chrome fixture returns verified title after cleanup', async () => { const { chromium } = await import(process.env.COOKBOOK_PLAYWRIGHT_MODULE); const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }); let closed = false; try { const page = await browser.newPage(); const run = fixture(page, async () => { await browser.close(); closed = true; }); const result = await run(); assert.equal(result.title, 'Browserbase cookbook worker check'); assert.equal(closed, true); } finally { await browser.close(); } });
