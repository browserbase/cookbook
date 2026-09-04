const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { safeValidateUIMessages } = require(process.env.COOKBOOK_AI_TEST_MODULE || 'ai');

async function ai() {
  return process.env.COOKBOOK_AI_TEST_MODULE ? import(process.env.COOKBOOK_AI_TEST_MODULE) : import('ai');
}

test('actual route permits dependent tools with a five-step bound', async () => {
  const sdk = await ai();
  let settings;
  const schema = { describe() { return this; } };
  const source = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../app/api/chat/route.ts'), 'utf8'))
    .replace(/^import .*;?\n/gm, '').replace(/export /g, '') + '\n' + stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../lib/browser-operation.ts'), 'utf8')).replace(/export /g, '');
  const context = {
    Response, requireSessionRequest() {}, safeValidateUIMessages, process: { env: { OPENAI_API_KEY: 'synthetic', ANTHROPIC_API_KEY: 'synthetic' } }, requireBrowserSession: () => ({ sessionId: 'synthetic-session' }), console,
    openai: () => 'synthetic model',
    convertToModelMessages: async messages => messages,
    tool: value => value,
    z: { object: () => schema, string: () => schema },
    isStepCount: sdk.isStepCount,
    streamText: options => { settings = options; return { toUIMessageStreamResponse: () => 'synthetic response' }; },
  };
  vm.runInNewContext(source, context);
  assert.equal(await context.POST({ json: async () => ({ messages: [{ id: 'user', role: 'user', parts: [{ type: 'text', text: 'Synthetic' }] }] }) }), 'synthetic response');
  assert.equal(await settings.stopWhen({ steps: [{}] }), false);
  assert.equal(await settings.stopWhen({ steps: [{}, {}] }), false);
  assert.equal(await settings.stopWhen({ steps: Array(5).fill({}) }), true);
  assert.equal(settings.tools.askForConfirmation.execute, undefined);
});

test('confirmation resumes only after every current-step tool has an output', async () => {
  const sdk = await ai();
  const source = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../lib/confirmation.ts'), 'utf8'))
    .replace(/^import .*;\n/gm, '').replace(/export /g, '');
  const context = { lastAssistantMessageIsCompleteWithToolCalls: sdk.lastAssistantMessageIsCompleteWithToolCalls };
  vm.runInNewContext(source, context);
  const check = parts => context.shouldResumeAfterConfirmation({ messages: [{ id: 'synthetic', role: 'assistant', parts }] });
  const confirmation = { type: 'tool-askForConfirmation', toolCallId: 'confirm', state: 'input-available', input: { message: 'Continue?' } };
  assert.equal(check([confirmation]), false);
  for (const confirmed of [true, false]) {
    const answered = { ...confirmation, state: 'output-available', output: { confirmed } };
    assert.equal(check([answered]), true);
    assert.equal(check([answered, { type: 'step-start' }, { type: 'tool-googleSearch', toolCallId: 'search', state: 'output-available', input: {}, output: {} }]), false);
    assert.equal(check([answered, { ...confirmation, toolCallId: 'second' }]), false);
  }
  assert.equal(check([{ type: 'tool-createSession', toolCallId: 'create', state: 'output-available', input: {}, output: { sessionId: 'synthetic' } }]), false);
});

test('real SDK runs search then final response without session credentials in model messages', async () => {
  const sdk = await ai();
  const { createRequire } = require('node:module');
  const { z } = createRequire(process.env.COOKBOOK_AI_TEST_MODULE || require.resolve('ai'))('zod');
  const events = [];
  let steps = 0;
  const model = {
    specificationVersion: 'v2', provider: 'synthetic', modelId: 'continuation', supportedUrls: {},
    async doStream({ prompt }) {
      steps++;
      assert.doesNotMatch(JSON.stringify(prompt), /synthetic-session|capability|debuggerFullscreenUrl/);
      if (steps === 2) assert.match(JSON.stringify(prompt), /synthetic search summary/);
      const call = steps === 1 ? {
        toolName: 'googleSearch', input: JSON.stringify({ query: 'synthetic query', toolName: 'Search' }),
      } : null;
      return { stream: new ReadableStream({ start(controller) {
        controller.enqueue({ type: 'stream-start', warnings: [] });
        if (call) controller.enqueue({ type: 'tool-call', toolCallId: `call-${steps}`, ...call });
        else {
          controller.enqueue({ type: 'text-start', id: 'text' });
          controller.enqueue({ type: 'text-delta', id: 'text', delta: 'Synthetic final answer' });
          controller.enqueue({ type: 'text-end', id: 'text' });
        }
        controller.enqueue({ type: 'finish', finishReason: call ? 'tool-calls' : 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } });
        controller.close();
      } }) };
    },
  };
  const page = {
    async goto(url) { events.push('search'); assert.match(url, /synthetic%20query/); },
    async waitForTimeout() {}, keyboard: { async press() {} }, async waitForLoadState() {}, async waitForSelector() {},
    async evaluate() { return [{ title: 'synthetic', description: 'result' }]; },
  };
  const source = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../app/api/chat/route.ts'), 'utf8'))
    .replace(/^import .*;?\n/gm, '').replace(/export /g, '') + '\n' + stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../lib/browser-operation.ts'), 'utf8')).replace(/export /g, '');
  const context = {
    Response, requireSessionRequest() {}, safeValidateUIMessages, process: { env: { OPENAI_API_KEY: 'synthetic', ANTHROPIC_API_KEY: 'synthetic' } }, requireBrowserSession: () => ({ sessionId: 'synthetic-session' }), console, URL, AbortSignal, z, ...sdk,
    openai: () => model, anthropic: () => 'synthetic summarizer',
    generateText: async () => ({ text: 'synthetic search summary' }),
    fetch: async url => {
      if (url.endsWith('/debug')) { events.push('debug'); return { ok: true, status: 200, json: async () => ({ debuggerFullscreenUrl: 'https://example.com/debug' }) }; }
      events.push('create'); return { ok: true, status: 200, json: async () => ({ id: 'synthetic-session' }) };
    },
    chromium: { async connectOverCDP(url) { assert.match(url, /sessionId=synthetic-session/); return { async close() { events.push('disconnect'); }, contexts: () => [{ pages: () => [page] }] }; } },
  };
  vm.runInNewContext(source, context);
  const response = await context.POST({ json: async () => ({ messages: [{ id: 'user', role: 'user', parts: [{ type: 'text', text: 'Synthetic search' }] }] }) });
  const text = await response.text();
  assert.match(text, /Synthetic final answer/);
  assert.equal(steps, 2);
  assert.deepEqual(events, ['search', 'disconnect']);
});

test('session creation rejects HTTP errors and malformed responses before returning success', async () => {
  const { createRequire } = require('node:module');
  const { z } = createRequire(process.env.COOKBOOK_AI_TEST_MODULE || require.resolve('ai'))('zod');
  const source = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../lib/browser-session.ts'), 'utf8'))
    .replace(/^import .*;?\n/gm, '').replace(/export /g, '') + '\n' + stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../lib/browser-operation.ts'), 'utf8')).replace(/export /g, '');
  const cases = [
    { responses: [{ ok: false, status: 401 }], error: /creation failed \(HTTP 401\)/ },
    { responses: [{ ok: false, status: 429 }], error: /creation failed \(HTTP 429\)/ },
    { responses: [{ ok: true, invalidJson: true }], error: /Browserbase returned invalid JSON/ },
    ...[null, {}, { id: '' }, { id: '../other' }, { id: 12 }].map(body => ({ responses: [{ ok: true, body }], error: /valid session ID/ })),
    { responses: [{ ok: true, body: { id: 'synthetic-id' } }, { ok: false, status: 503 }], error: /debug request failed \(HTTP 503\)/ },
    ...[{}, { debuggerFullscreenUrl: 'javascript:alert(1)' }, { debuggerFullscreenUrl: 'http://example.com/' }].map(body => ({ responses: [{ ok: true, body: { id: 'synthetic-id' } }, { ok: true, body }], error: /valid HTTPS/ })),
  ];
  for (const sample of cases) {
    let settings, calls = 0, releases = 0;
    const context = {
      SESSION_LIFETIME_SECONDS: 900, Response, requireSessionRequest() {}, safeValidateUIMessages, process: { env: { OPENAI_API_KEY: 'synthetic', ANTHROPIC_API_KEY: 'synthetic' } }, requireBrowserSession: () => ({ sessionId: 'synthetic-session' }), console, URL, AbortSignal, z,
      openai: () => 'synthetic', tool: value => value, isStepCount: () => () => false,
      convertToModelMessages: async messages => messages,
      streamText: options => { settings = options; return { toUIMessageStreamResponse() {} }; },
      fetch: async (url, options) => {
        if (options?.body && JSON.parse(options.body).status === 'REQUEST_RELEASE') {
          assert.equal(sample.responses.length, 2, 'only an acquired session is released');
          assert.equal(url, 'https://api.browserbase.com/v1/sessions/synthetic-id');
          assert.equal(options.method, 'POST');
          assert.ok(options.signal);
          releases++;
          return { ok: true, status: 200 };
        }
        const response = sample.responses[calls++];
        assert.ok(response, 'unexpected followup request');
        return { ok: response.ok, status: response.status || 200, json: async () => { assert.ok(response.ok, 'error response body must not be parsed'); if (response.invalidJson) throw new Error('synthetic sensitive body'); return response.body; } };
      },
    };
    vm.runInNewContext(source, context);
    await assert.rejects(context.createBrowserSession(), sample.error);
    assert.equal(calls, sample.responses.length);
    assert.equal(releases, sample.responses.length === 2 ? 1 : 0);
  }
});

test('both browser tools close each acquired CDP connection on success and failure', async () => {
  const { createRequire } = require('node:module');
  const { z } = createRequire(process.env.COOKBOOK_AI_TEST_MODULE || require.resolve('ai'))('zod');
  const source = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../app/api/chat/route.ts'), 'utf8'))
    .replace(/^import .*;?\n/gm, '').replace(/export /g, '') + '\n' + stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../lib/browser-operation.ts'), 'utf8')).replace(/export /g, '');
  for (const toolName of ['googleSearch', 'getPageContent']) {
    for (const failure of [null, 'connect', 'page', 'navigate', 'extract', 'model']) {
      let settings, closes = 0;
      const fail = at => { if (failure === at) throw new Error(`synthetic ${at}`); };
      const page = {
        async goto() { fail('navigate'); }, async waitForTimeout() {}, keyboard: { async press() {} },
        async waitForLoadState() {}, async waitForSelector() {},
        async evaluate() { fail('extract'); return [{ title: 'synthetic', description: 'result' }]; },
        async content() { fail('extract'); return '<main>synthetic</main>'; },
      };
      const context = {
        Response, requireSessionRequest() {}, safeValidateUIMessages, process: { env: { OPENAI_API_KEY: 'synthetic', ANTHROPIC_API_KEY: 'synthetic' } }, requireBrowserSession: () => ({ sessionId: 'synthetic-session' }), console: { error() {} }, URL, z,
        openai: () => 'synthetic', anthropic: () => 'synthetic', tool: value => value, isStepCount: () => () => false,
        convertToModelMessages: async messages => messages,
        streamText: options => { settings = options; return { toUIMessageStreamResponse() {} }; },
        generateText: async () => { fail('model'); return { text: 'synthetic summary' }; },
        JSDOM: class { window = { document: {} }; },
        Readability: class { parse() { return { title: 'synthetic', textContent: 'synthetic' }; } },
        chromium: { async connectOverCDP() { fail('connect'); return { async close() { closes++; }, contexts() { fail('page'); return [{ pages: () => [page] }]; } }; } },
      };
      vm.runInNewContext(source, context);
      await context.POST({ json: async () => ({ messages: [{ id: 'user', role: 'user', parts: [{ type: 'text', text: 'Synthetic' }] }] }) });
      const result = await settings.tools[toolName].execute({ query: 'synthetic', url: 'https://example.com/', sessionId: 'synthetic' });
      assert.equal(closes, failure === 'connect' ? 0 : 1, `${toolName}/${failure}`);
      assert.match(result.content, failure ? /Error/ : /synthetic summary/);
    }
  }
});

test('failed setup reports both original and cleanup errors when session release fails', async () => {
  const { createRequire } = require('node:module');
  const { z } = createRequire(process.env.COOKBOOK_AI_TEST_MODULE || require.resolve('ai'))('zod');
  const source = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../lib/browser-session.ts'), 'utf8'))
    .replace(/^import .*;?\n/gm, '').replace(/export /g, '') + '\n' + stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../lib/browser-operation.ts'), 'utf8')).replace(/export /g, '');
  for (const failure of ['http', 'network']) {
    let settings, releases = 0, timeout;
    const context = {
      SESSION_LIFETIME_SECONDS: 900, Response, requireSessionRequest() {}, safeValidateUIMessages, process: { env: { OPENAI_API_KEY: 'synthetic', ANTHROPIC_API_KEY: 'synthetic' } }, requireBrowserSession: () => ({ sessionId: 'synthetic-session' }), console, URL, z,
      AbortSignal: { timeout(ms) { timeout = ms; return { synthetic: true }; } },
      openai: () => 'synthetic', tool: value => value, isStepCount: () => () => false,
      convertToModelMessages: async messages => messages,
      streamText: options => { settings = options; return { toUIMessageStreamResponse() {} }; },
      fetch: async (url, options) => {
        if (url.endsWith('/debug')) return { ok: false, status: 503 };
        if (JSON.parse(options.body).status === 'REQUEST_RELEASE') {
          releases++;
          if (failure === 'network') throw new Error('synthetic cleanup connection failure');
          return { ok: false, status: 502 };
        }
        return { ok: true, json: async () => ({ id: 'synthetic-owned' }) };
      },
    };
    vm.runInNewContext(source, context);
    await assert.rejects(context.createBrowserSession(), error => {
      assert.equal(error.name, 'AggregateError');
      assert.match(error.errors[0].message, /debug request failed.*503/);
      assert.match(error.errors[1].message, failure === 'http' ? /release failed.*502/ : /cleanup connection failure/);
      return true;
    });
    assert.equal(releases, 1);
    assert.equal(timeout, 10000);
  }
});
