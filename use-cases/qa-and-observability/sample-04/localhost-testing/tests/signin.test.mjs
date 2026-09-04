import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
const server = readFileSync(process.env.SIGNIN_SERVER_SOURCE || new URL('../server.mjs', import.meta.url), 'utf8');
const html = vm.runInNewContext(server.slice(server.indexOf('const html ='), server.indexOf('http.createServer')) + '\nhtml;');
const yaml = readFileSync(process.env.SIGNIN_YAML_SOURCE || new URL('../acme-signin.test.yaml', import.meta.url), 'utf8');
const code = yaml.split('      code: |\n')[1].split('      environment:')[0].split('\n').map(line => line.slice(8)).join('\n');
async function fixture(run) {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto('https://synthetic.invalid');
    await run(page);
  } finally { await browser.close(); }
}
test('actual deterministic YAML activates the button and shows the signed-in dashboard', async () => {
  await fixture(async page => {
    const ids = await page.locator('[id]').evaluateAll(elements => elements.map(el => el.id));
    assert.equal(new Set(ids).size, ids.length, 'IDs must be unique');
    assert.equal(await page.locator('#dashboard-card').isVisible(), false);
    await page.evaluate('(async () => {\n' + code + '\n})()');
    assert.equal(await page.locator('#dashboard-card').isVisible(), true);
    assert.equal(await page.locator('#login-card').isVisible(), false);
    assert.equal(await page.locator('#who').textContent(), 'Signed in as qa@momentic.ai');
  });
});
test('hidden preexisting welcome text cannot satisfy the deterministic login step', async () => {
  await fixture(async page => {
    await page.evaluate(() => { window.doLogin = () => {}; });
    await assert.rejects(page.evaluate('(async () => {\n' + code + '\n})()'), /Expected a visible signed-in dashboard/);
    assert.equal(await page.locator('#dashboard-card').isVisible(), false);
  });
});
