const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { stripTypeScriptTypes, createRequire } = require('node:module');
const { z } = createRequire(process.env.COOKBOOK_AI_TEST_MODULE || require.resolve('ai'))('zod');
const { safeValidateUIMessages } = require(process.env.COOKBOOK_AI_TEST_MODULE || 'ai');
const secret = 'ab'.repeat(32);

function source(file) {
  return stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'))
    .replace(/^import .*;?\n/gm, '').replace(/export /g, '');
}
function request(method, capability, overrides = {}) {
  return new Request('https://cookbook.test/api/session', {
    method, headers: { origin: 'https://cookbook.test', 'content-type': 'application/json',
      'x-browsegpt-client': '1', ...(capability ? { 'x-browsegpt-session': capability } : {}), ...overrides },
    body: JSON.stringify({ messages: [{ id: 'user', role: 'user', parts: [{ type: 'text', text: 'Synthetic' }] }] }),
  });
}
function setup() {
  const events = [];
  let released = false;
  const context = {
    ...crypto, safeValidateUIMessages, Buffer, Response, URL, AbortSignal, z, console,
    process: { env: { OPENAI_API_KEY: 'synthetic', ANTHROPIC_API_KEY: 'synthetic', BROWSEGPT_SESSION_SECRET: secret, BROWSERBASE_PROJECT_ID: 'project-test', BROWSERBASE_API_KEY: 'synthetic-api-key' } },
    fetch: async (url, options) => {
      events.push({ url, options });
      if (url.endsWith('/debug')) return { ok: true, json: async () => ({ debuggerFullscreenUrl: 'https://browser.test/debug' }) };
      if (JSON.parse(options.body).status === 'REQUEST_RELEASE') { released = true; return { ok: true }; }
      assert.equal(JSON.parse(options.body).timeout, 900);
      return { ok: true, json: async () => ({ id: 'session-owned' }) };
    },
  };
  vm.createContext(context);
  vm.runInContext(source('lib/session-capability.ts') + source('lib/session-request.ts') +
    source('lib/browser-session.ts') + source('app/api/session/route.ts'), context);
  return { context, events, released: () => released };
}

test('actual create and delete endpoints issue a private credential and release only its bound session', async () => {
  const { context, events, released } = setup();
  const created = await context.POST(request('POST'));
  assert.equal(created.status, 200);
  assert.equal(created.headers.get('cache-control'), 'no-store');
  const session = await created.json();
  assert.deepEqual(Object.keys(session).sort(), ['capability', 'debuggerUrl', 'expiresAt']);
  const claims = context.verifySessionCapability(session.capability, secret, 'project-test');
  assert.equal(claims.sessionId, 'session-owned');
  assert.equal(events.length, 2);
  const ended = await context.DELETE(request('DELETE', session.capability));
  assert.equal(ended.status, 204);
  assert.equal(released(), true);
  assert.equal(events.at(-1).url, 'https://api.browserbase.com/v1/sessions/session-owned');
});

test('cross-origin requests and missing configuration allocate nothing', async () => {
  const { context, events } = setup();
  for (const headers of [{ origin: 'https://attacker.test' }, { origin: '' }, { 'x-browsegpt-client': '' }, { 'content-type': 'text/plain' }]) {
    assert.equal((await context.POST(request('POST', null, headers))).status, 403);
  }
  context.process.env.BROWSEGPT_SESSION_SECRET = 'short';
  assert.equal((await context.POST(request('POST'))).status, 503);
  assert.equal(events.length, 0);
});

test('invalid release credentials never touch Browserbase and failed release remains retryable', async () => {
  const { context, events } = setup();
  for (const value of [null, 'session-owned', 'forged.signature']) {
    assert.equal((await context.DELETE(request('DELETE', value))).status, 401);
  }
  assert.equal(events.length, 0);
  const { capability } = await (await context.POST(request('POST'))).json();
  const original = context.fetch;
  context.fetch = async () => ({ ok: false, status: 503 });
  const failed = await context.DELETE(request('DELETE', capability));
  assert.equal(failed.status, 502);
  assert.doesNotMatch(await failed.text(), /synthetic-api-key|session-owned/);
  context.fetch = original;
  assert.equal((await context.DELETE(request('DELETE', capability))).status, 204);
});

test('chat validates before invoking SDK and browser tools ignore model-supplied session IDs', async () => {
  const state = setup();
  const { capability } = await (await state.context.POST(request('POST'))).json();
  let sdkCalls = 0, settings, connected;
  const context = {
    ...crypto, safeValidateUIMessages, Buffer, Response, URL, z, console, process: state.context.process,
    openai: () => 'synthetic', anthropic: () => 'synthetic', isStepCount: () => () => false,
    tool: value => value, convertToModelMessages: async messages => messages,
    streamText: options => { sdkCalls++; settings = options; return { toUIMessageStreamResponse: () => new Response('ok') }; },
    chromium: { async connectOverCDP(url) { connected = url; throw new Error('synthetic browser failure'); } },
  };
  vm.createContext(context);
  vm.runInContext(source('lib/session-capability.ts') + source('lib/session-request.ts') + source('lib/browser-operation.ts') + source('app/api/chat/route.ts'), context);
  for (const value of [null, 'session-owned', 'forged.signature']) {
    assert.equal((await context.POST(request('POST', value))).status, 401);
  }
  const otherProject = context.issueSessionCapability({ sessionId: 'session-other', conversationId: 'conversation-other', projectId: 'other-project' }, secret).capability;
  assert.equal((await context.POST(request('POST', otherProject))).status, 401);
  assert.equal(sdkCalls, 0);
  assert.equal((await context.POST(request('POST', capability))).status, 200);
  assert.equal(settings.tools.createSession, undefined);
  for (const name of ['googleSearch', 'getPageContent']) {
    assert.equal(settings.tools[name].inputSchema.shape.sessionId, undefined);
    assert.equal(settings.tools[name].inputSchema.shape.debuggerFullscreenUrl, undefined);
    await settings.tools[name].execute({ query: 'synthetic', url: 'https://example.com', sessionId: 'model-selected-other' });
    assert.equal(new URL(connected).searchParams.get('sessionId'), 'session-owned');
  }
});


test('actual chat tools serialize page operations and revalidate queued work after expiry or cancellation', async () => {
  const state = setup();
  const { capability } = await (await state.context.POST(request('POST'))).json();
  for (const invalidation of ['none', 'expired', 'aborted']) {
    let settings, entered = 0, active = 0, maxActive = 0, unblock;
    const controller = new AbortController();
    const context = {
      ...crypto, safeValidateUIMessages, Buffer, Response, URL, z, console, process: state.context.process,
      openai: () => 'synthetic', anthropic: () => 'synthetic', isStepCount: () => () => false,
      tool: value => value, convertToModelMessages: async messages => messages,
      streamText: options => { settings = options; return { toUIMessageStreamResponse: () => new Response('ok') }; },
      generateText: async () => ({ text: 'synthetic' }),
      JSDOM: class { window = { document: {} }; }, Readability: class { parse() { return {}; } },
      chromium: { async connectOverCDP() {
        entered++; active++; maxActive = Math.max(maxActive, active);
        return { async close() { active--; }, contexts: () => [{ pages: () => [{
          async goto() { if (entered === 1) await new Promise(resolve => { unblock = resolve; }); },
          async content() { return '<main>synthetic</main>'; },
        }] }] };
      } },
    };
    vm.createContext(context);
    vm.runInContext(source('lib/session-capability.ts') + source('lib/session-request.ts') + source('lib/browser-operation.ts') + source('app/api/chat/route.ts'), context);
    const req = new Request(request('POST', capability), { signal: controller.signal });
    await context.POST(req);
    const first = settings.tools.getPageContent.execute({ url: 'https://example.com/first' });
    await new Promise(resolve => setImmediate(resolve));
    const second = settings.tools.getPageContent.execute({ url: 'https://example.com/second' });
    assert.equal(entered, 1);
    if (invalidation === 'expired') {
      context.Date = class extends Date { static now() { return Date.now() + 3600_000; } };
    }
    if (invalidation === 'aborted') controller.abort();
    const failed = invalidation !== 'none' ? assert.rejects(second) : null;
    unblock(); await first;
    if (failed) await failed; else await second;
    assert.equal(entered, invalidation === 'none' ? 2 : 1);
    assert.equal(maxActive, 1);
    assert.equal(active, 0);
  }
});

test('actual SDK validation returns bounded400 for invalid bodies and preserves both confirmation answers', async () => {
  const sdk = require(process.env.COOKBOOK_AI_TEST_MODULE || 'ai');
  const state = setup();
  const { capability } = await (await state.context.POST(request('POST'))).json();
  let providerCalls = 0, settings;
  const context = {
    ...crypto, Buffer, Response, URL, z, process: state.context.process,
    safeValidateUIMessages: sdk.safeValidateUIMessages, convertToModelMessages: sdk.convertToModelMessages,
    openai: () => { providerCalls++; return 'synthetic'; }, tool: value => value, isStepCount: sdk.isStepCount,
    streamText: options => { settings = options; return { toUIMessageStreamResponse: () => new Response('ok') }; },
  };
  vm.createContext(context);
  vm.runInContext(source('lib/session-capability.ts') + source('lib/session-request.ts') + source('lib/browser-operation.ts') + source('app/api/chat/route.ts'), context);
  const postBody = value => new Request('https://cookbook.test/api/chat', {
    method: 'POST', headers: request('POST', capability).headers,
    body: typeof value === 'string' ? value : JSON.stringify(value),
  });
  for (const body of ['{broken', null, {}, { messages: null }, { messages: [] }, { messages: {} },
    { messages: [null] }, { messages: [{ id: 'user', role: 'user', parts: [] }] },
    { messages: [{ id: 'user', role: 'invalid', parts: [{ type: 'text', text: 'synthetic' }] }] },
    { messages: [{ id: 'user', role: 'user', parts: [{ type: 'text', text: 42 }] }] },
  ]) {
    const response = await context.POST(postBody(body));
    assert.equal(response.status, 400);
    assert.ok((await response.json()).error.length < 100);
    assert.equal(providerCalls, 0);
  }
  const user = { id: 'user', role: 'user', parts: [{ type: 'text', text: 'Synthetic request' }] };
  for (const confirmed of [true, false]) {
    const assistant = { id: 'assistant', role: 'assistant', parts: [{ type: 'tool-askForConfirmation', toolCallId: 'confirm', state: 'output-available', input: { message: 'Continue?' }, output: { confirmed } }] };
    assert.equal((await context.POST(postBody({ messages: [user, assistant] }))).status, 200);
    assert.match(JSON.stringify(settings.messages), new RegExp(`"confirmed":${confirmed}`));
  }
  const callsBefore = providerCalls;
  delete context.process.env.OPENAI_API_KEY;
  assert.equal((await context.POST(postBody({ messages: [user] }))).status, 503);
  assert.equal(providerCalls, callsBefore);
  delete context.process.env.BROWSERBASE_API_KEY;
  assert.equal((await context.POST(postBody({}))).status, 400, 'malformed input validation does not depend on provider configuration');
});
