import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { z } = require(process.env.ZOD_MODULE_PATH || 'zod');
const root = new URL('../', import.meta.url);
let registered;
const registration = vm.createContext({
  z,
  defineFn: (name, _handler, options) => { registered = { name, schema: options.parametersSchema }; },
});
vm.runInContext(stripTypeScriptTypes(readFileSync(new URL('index.ts', root), 'utf8').replace(/^import .*;\n/gm, '')), registration);
const readme = readFileSync(process.env.README_CONTRACT_PATH || new URL('README.md', root), 'utf8');
const example = readme.match(/```javascript\n([\s\S]*?)\n```/)[1];
const scope = vm.createContext({ AbortSignal });
vm.runInContext(example + '\nglobalThis.request = requestReservation;', scope);
const env = { BROWSERBASE_API_KEY: 'synthetic-browserbase', FUNCTION_ID: '00000000-0000-4000-8000-000000000001', MODEL_API_KEY: 'synthetic-primitive', OPENAI_API_KEY: 'synthetic-outer' };

test('exact README request matches registered schema and asynchronous Functions envelope', async () => {
  let requests = 0;
  const invocation = await scope.request(env, async (url, options) => {
    requests++;
    assert.equal(url, `https://api.browserbase.com/v1/functions/${env.FUNCTION_ID}/invoke`);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['x-bb-api-key'], env.BROWSERBASE_API_KEY);
    const body = JSON.parse(options.body);
    assert.deepEqual(Object.keys(body), ['params']);
    const parsed = registered.schema.strict().parse(body.params);
    assert.equal(registered.name, 'book-reservation');
    assert.equal(parsed.apiKey, env.MODEL_API_KEY);
    assert.equal(parsed.agentApiKey, env.OPENAI_API_KEY);
    assert.ok(parsed.restaurantName);
    assert.ok(Date.parse(parsed.date) > Date.now());
    return { ok: true, json: async () => ({ id: 'synthetic-invocation', status: 'PENDING' }) };
  });
  assert.equal(requests, 1);
  assert.equal(invocation.status, 'PENDING');
});

test('README request rejects missing configuration before transport', async () => {
  for (const name of Object.keys(env)) {
    await assert.rejects(scope.request({ ...env, [name]: ' ' }, () => { assert.fail('Transport called'); }), /Missing/);
  }
});

test('README request reports HTTP failure and absent invocation ID without retry', async () => {
  await assert.rejects(scope.request(env, async () => ({ ok: false, status: 400 })), /HTTP 400/);
  await assert.rejects(scope.request(env, async () => ({ ok: true, json: async () => ({}) })), /Missing invocation ID/);
});
