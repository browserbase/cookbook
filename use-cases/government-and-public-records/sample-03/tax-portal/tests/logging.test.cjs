const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const util = require('node:util');
const { stripTypeScriptTypes } = require('node:module');
const CODE = '827491';
const SECRET = 'sk_private_fixture_value_ABCDEF';
const PRIVATE_ERROR = `synthetic-provider-error ${SECRET} ${CODE}`;

async function run(name, mode) {
  let source = fs.readFileSync(path.join(__dirname, `../${name}`), 'utf8').replace(/^import .*;\n/gm, '');
  const entry = name === 'test-email.ts' ? 'test' : 'main';
  source = source.replace(new RegExp(`\\n${entry}\\(\\);\\s*$`), `\nglobalThis.done = ${entry}();`);
  source = source.replace(/\nmain\(\)(?=\.catch)/, "\nglobalThis.done = main()");
  const logs = [];
  const fills = []; const prompts = []; const closed = { browser: 0, stagehand: 0 };
  const page = { goto: async () => {}, waitForTimeout: async () => {}, evaluate: async () => `<div>${CODE}</div>`, locator: selector => ({ count: async () => mode === 'ambiguous-input' ? 2 : 1, fill: async value => { fills.push({ selector, value }); } }) };
  const context = { activePage: async () => page, newPage: async () => page, setActivePage: async () => {} };
  const stagehand = {
    browser: { context, close: async () => {}, sessionId: 'synthetic-session' },
    rpcClient: { browserWebSocketDebuggerUrl: 'ws://fixture.test' },
    act: async prompt => { prompts.push(prompt); if (mode === 'action-error') throw Error(PRIVATE_ERROR); return { data: { success: mode !== 'search-declined' } }; },
    extract: async () => { if (mode === 'extract-error') throw Error(PRIVATE_ERROR); return { data: { otp: mode === 'invalid-code' ? 'not-six-digits' : CODE } }; },
    close: async () => { closed.stagehand++; if (['cleanup-error', 'dual-cleanup-error'].includes(mode)) throw Error(PRIVATE_ERROR); },
  };
  const control = { on: () => {}, context: () => ({ newCDPSession: async () => ({ send: async () => {} }) }) };
  const env = {
    PORTAL_URL: 'https://portal.example.test', BROWSERBASE_CONTEXT_ID: 'fixture-context',
    BROWSERBASE_API_KEY: SECRET, BROWSERBASE_PROJECT_ID: 'fixture-project', OPENAI_API_KEY: SECRET,
    RESEND_API_KEY: SECRET, USER_EMAIL: 'private-recipient-marker@example.test', FROM_EMAIL: 'private-sender-marker@example.test',
  };
  let sends = 0;
  const sandbox = vm.createContext({
    downloadStatement: async () => {
      if (mode === 'download-error') throw Error(PRIVATE_ERROR);
      return { path: '/synthetic/statement.pdf', bytes: 931, sha256: 'a'.repeat(64) };
    },
    readPortalRequest: async () => ({ requestId: 'a'.repeat(32), sender: 'sender@example.test', subject: 'Tax Portal Verification - ' + 'a'.repeat(32) }),
    retrieveGmailOtp: async (_page, _request, search) => {
      await search('synthetic nonsecret search');
      if (mode === 'extract-error') throw Error(PRIVATE_ERROR);
      return mode === 'invalid-code' ? 'not-six-digits' : CODE;
    },
    URL, console: { log: (...args) => logs.push(util.inspect(args)), error: (...args) => logs.push(util.inspect(args)) },
    process: { env, exitCode: 0 }, dotenv: { config: () => {} },
    Stagehand: { create: async () => { if (mode === 'startup-error') throw Error(PRIVATE_ERROR); return stagehand; } }, StagehandCreateOptionsSchema: { parse: value => value },
    browserbase: { launch: async () => ({ close: async () => { closed.browser++; if (['browser-cleanup-error', 'dual-cleanup-error'].includes(mode)) throw Error(PRIVATE_ERROR); } }) }, localBrowser: { launch: async () => ({ close: async () => { closed.browser++; if (['browser-cleanup-error', 'dual-cleanup-error'].includes(mode)) throw Error(PRIVATE_ERROR); } }) },
    chromium: { connectOverCDP: async () => ({ contexts: () => [{ pages: () => [control] }] }) },
    z: { object: value => value, string: () => ({ describe: () => ({}) }) },
    Resend: class { constructor() { this.emails = { send: async () => {
      sends++;
      if (mode === 'send-error') throw Error(PRIVATE_ERROR);
      return mode === 'rejection' ? { data: null, error: { message: PRIVATE_ERROR } } : { data: { id: SECRET }, error: null };
    } }; } },
  });
  vm.runInContext(stripTypeScriptTypes(source), sandbox);
  await sandbox.done;
  const output = logs.join('\n');
  for (const value of [CODE, SECRET, SECRET.slice(0, 10), PRIVATE_ERROR, env.USER_EMAIL, env.FROM_EMAIL]) assert(!output.includes(value), `${name} leaked a synthetic marker in ${mode}`);
  assert(!prompts.some(prompt => prompt.includes(CODE)), `${name} put the code in a model prompt`);
  if (['automate.ts', 'automate-local.ts'].includes(name)) {
    if (mode === 'success') assert.deepEqual(fills, [{ selector: 'input[name="otp"]', value: CODE }]);
    if (['invalid-code', 'ambiguous-input'].includes(mode)) assert.equal(fills.length, 0);
  }
  if (['automate.ts', 'automate-local.ts'].includes(name)) {
    assert.equal(closed.browser, 1, 'owned browser always closes once');
    assert.equal(closed.stagehand, mode === 'startup-error' ? 0 : 1, 'initialized Stagehand closes once');
    if (mode !== 'success') assert.equal(sandbox.process.exitCode, 1, 'failed automation must exit nonzero');
  }
  return { output, code: sandbox.process.exitCode, sends };
}
for (const name of ['automate.ts', 'automate-local.ts', 'test-gmail-otp.ts']) {
  for (const mode of ['success', 'action-error', 'extract-error']) test(`${name} omits codes and raw sensitive errors: ${mode}`, async () => { await run(name, mode); });
}
for (const mode of ['success', 'rejection', 'send-error']) test(`test-email logs acceptance/failure only: ${mode}`, async () => {
  const result = await run('test-email.ts', mode); assert.equal(result.sends, 1);
  assert.equal(result.code, mode === 'success' ? 0 : 1);
  assert.equal(result.output.includes('accepted by the provider'), mode === 'success');
});

for (const name of ['automate.ts', 'automate-local.ts']) for (const mode of ['invalid-code', 'ambiguous-input']) test(`${name} refuses unsafe direct fill: ${mode}`, async () => { await run(name, mode); });

for (const name of ['automate.ts', 'automate-local.ts', 'test-gmail-otp.ts']) for (const mode of ['startup-error', 'cleanup-error']) test(`${name} contains sensitive terminal errors: ${mode}`, async () => { const result = await run(name, mode); assert.equal(result.code, 1); });

for (const name of ['automate.ts', 'automate-local.ts']) for (const mode of ['browser-cleanup-error', 'dual-cleanup-error']) test(`${name} surfaces independently attempted cleanup failures: ${mode}`, async () => { const result = await run(name, mode); assert.equal(result.code, 1); assert(!result.output.includes('Saved verified synthetic PDF')); });

for (const name of ['automate.ts', 'automate-local.ts', 'test-gmail-otp.ts']) test(`${name} rejects unsuccessful real-shape action result`, async () => { const result = await run(name, 'search-declined'); assert.equal(result.code, 1); });

for (const name of ['automate.ts', 'automate-local.ts']) test(`${name} cannot report success after download failure`, async () => { const result = await run(name, 'download-error'); assert.equal(result.code, 1); assert(!result.output.includes('Saved verified synthetic PDF')); });
