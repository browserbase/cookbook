const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

function fixture({ failCreate = false, failClose = false } = {}) {
  const browsers = [];
  const source = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../src/mastra/tools/browser-owner.ts'), 'utf8'))
    .replace(/^import .*;\n/gm, '').replace('export class BrowserOwner', 'globalThis.BrowserOwner = class BrowserOwner').replace(/export function /g, 'function ');
  const context = {
    process: { env: {} }, console,
    browserbase: { async launch() {
      const browser = { url: '', closed: 0, async close() { this.closed++; } };
      browsers.push(browser);
      return browser;
    } },
    Stagehand: { async create({ browser }) {
      if (failCreate) { failCreate = false; throw new Error('synthetic initialization'); }
      return { browser, async close() { if (failClose) throw new Error('synthetic close'); } };
    } },
  };
  vm.runInNewContext(source, context);
  return { Owner: context.BrowserOwner, browsers, context };
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('independent owners remain isolated during interleaved operations', async () => {
  const { Owner, browsers } = fixture();
  const a = new Owner(), b = new Owner(), started = deferred(), resume = deferred();
  const first = a.run(async session => {
    session.browser.url = 'A'; started.resolve(); await resume.promise;
    return session.browser.url;
  });
  await started.promise;
  assert.equal(await b.run(async session => { session.browser.url = 'B'; return session.browser.url; }), 'B');
  resume.resolve();
  assert.equal(await first, 'A');
  await Promise.all([a.close(), b.close()]);
  assert.equal(browsers.length, 2);
  assert.deepEqual(browsers.map(browser => browser.closed), [1, 1]);
});

test('serializes accepted work, drains before close, rejects new work', async () => {
  const { Owner, browsers } = fixture();
  const owner = new Owner(), started = deferred(), resume = deferred(), events = [];
  const first = owner.run(async session => {
    session.browser.url = 'A'; started.resolve(); await resume.promise; events.push('first');
  });
  await started.promise;
  const second = owner.run(async session => { assert.equal(session.browser.url, 'A'); events.push('second'); });
  const closing = owner.close();
  assert.equal(owner.close(), closing);
  await assert.rejects(owner.run(async () => {}), /closed/);
  assert.equal(browsers[0].closed, 0);
  resume.resolve();
  await Promise.all([first, second, closing]);
  assert.deepEqual(events, ['first', 'second']);
  assert.equal(browsers[0].closed, 1);
});

test('operation and initialization failures permit subsequent work', async () => {
  const { Owner, browsers } = fixture({ failCreate: true });
  const owner = new Owner();
  await assert.rejects(owner.run(async () => {}), /initialization/);
  assert.equal(browsers[0].closed, 1);
  await assert.rejects(owner.run(async () => { throw new Error('synthetic operation'); }), /operation/);
  assert.equal(await owner.run(async () => 'recovered'), 'recovered');
  await owner.close();
  assert.deepEqual(browsers.map(browser => browser.closed), [1, 1]);
});

test('always releases underlying browser when Stagehand close fails', async () => {
  const { Owner, browsers } = fixture({ failClose: true });
  const owner = new Owner();
  await owner.run(async () => {});
  await assert.rejects(owner.close(), /synthetic close/);
  assert.equal(browsers[0].closed, 1);
});

test('closing an unused owner creates no browser', async () => {
  const { Owner, browsers } = fixture();
  const owner = new Owner();
  await owner.close();
  await assert.rejects(owner.run(async () => {}), /closed/);
  assert.equal(browsers.length, 0);
});

test('actual tools require trusted ownership and preserve request isolation', async () => {
  const { context, browsers } = fixture();
  const schema = { optional() { return this; } };
  context.z = Object.fromEntries(['object', 'url', 'string', 'boolean', 'record', 'json'].map(key => [key, () => schema]));
  context.createTool = value => value;
  const arrived = deferred(), resume = deferred();
  context.Stagehand.create = async ({ browser }) => {
    const page = {
      async goto(url) { browser.url = url; if (url === 'https://a.example/') { arrived.resolve(); await resume.promise; } },
      async title() { return browser.url; }, async url() { return browser.url; },
    };
    browser.context = { pages: async () => [page] };
    return { browser, close: async () => {}, act: async () => ({ data: { success: true, message: browser.url } }) };
  };
  const toolsSource = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../src/mastra/tools/index.ts'), 'utf8'))
    .replace(/^import .*;\n/gm, '').replace(/export const /g, 'globalThis.');
  vm.runInNewContext(toolsSource, context);
  await assert.rejects(context.stagehandActTool.execute({ action: 'synthetic' }), /server-owned/);
  await assert.rejects(context.stagehandActTool.execute({ action: 'synthetic' }, { requestContext: { owner: 'forged' } }), /server-owned/);
  assert.equal(browsers.length, 0);
  const requestA = {}, requestB = {};
  const ownerA = context.bindBrowserOwner(requestA), ownerB = context.bindBrowserOwner(requestB);
  assert.throws(() => context.bindBrowserOwner(requestA), /already/);
  const a = context.stagehandActTool.execute({ url: 'https://a.example/', action: 'A' }, { requestContext: requestA });
  await arrived.promise;
  const b = await context.stagehandActTool.execute({ url: 'https://b.example/', action: 'B' }, { requestContext: requestB });
  resume.resolve();
  assert.equal((await a).message, 'https://a.example/');
  assert.equal(b.message, 'https://b.example/');
  assert.equal((await context.stagehandActTool.execute({ action: 'A followup' }, { requestContext: requestA })).message, 'https://a.example/');
  await Promise.all([ownerA.close(), ownerB.close()]);
  assert.deepEqual(browsers.map(browser => browser.closed), [1, 1]);
});

function lifecycleFixture() {
  const { context, browsers } = fixture();
  context.RequestContext = Map;
  const source = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../src/mastra/agents/browser-lifecycle.ts'), 'utf8'))
    .replace(/^import .*;\n/gm, '').replace(/export function /g, 'function ');
  vm.runInNewContext(source, context);
  class Agent {
    #receiver = 'original receiver';
    constructor(config) { this.config = config; }
    async generate(message, options) {
      assert.equal(this.#receiver, 'original receiver');
      const result = await context.browserOwnerFor(options.requestContext).run(async session => {
        session.browser.url = message;
        await options.pause?.();
        if (options.fail) throw new Error('synthetic generation');
        return { text: session.browser.url, requestContext: options.requestContext };
      });
      await options.onFinish?.({ text: result.text });
      return result;
    }
    async stream(message, options) {
      assert.equal(this.#receiver, 'original receiver');
      const owner = context.browserOwnerFor(options.requestContext);
      await owner.run(async session => { session.browser.url = message; });
      if (options.fail) throw new Error('synthetic stream setup');
      return {
        read: () => owner.run(async session => session.browser.url),
        finish: () => options.onFinish?.({ text: message }),
        error: () => options.onError?.({ error: new Error('synthetic stream error') }),
        abort: () => options.onAbort?.({}),
      };
    }
  }
  context.Agent = Agent;
  for (const name of ['stagehandActTool', 'stagehandObserveTool', 'stagehandExtractTool', 'stagehandNavigateTool']) context[name] = {};
  const registered = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../src/mastra/agents/index.ts'), 'utf8'))
    .replace(/^import[\s\S]*?;\n/gm, '').replace('export const webAgent', 'globalThis.webAgent');
  vm.runInNewContext(registered, context);
  return { context, browsers, agent: context.webAgent };
}

test('registered agent isolates overlapping generations with reused caller context', async () => {
  const { agent, browsers, context } = lifecycleFixture();
  const callerContext = new Map([['locale', 'en']]);
  const started = deferred(), resume = deferred();
  const a = agent.generate('A', { requestContext: callerContext, pause: async () => { started.resolve(); await resume.promise; } });
  await started.promise;
  const b = await agent.generate('B', { requestContext: callerContext });
  resume.resolve();
  const resultA = await a;
  assert.equal(resultA.text, 'A');
  assert.equal(b.text, 'B');
  assert.notEqual(resultA.requestContext, b.requestContext);
  assert.notEqual(resultA.requestContext, callerContext);
  assert.equal(resultA.requestContext.get('locale'), 'en');
  assert.deepEqual(browsers.map(browser => browser.closed), [1, 1]);
  assert.equal(context.installBrowserLifecycle(agent), agent);
});

test('stream remains open until terminal callback, including caller callback failure', async () => {
  for (const terminal of ['finish', 'error', 'abort']) {
    const { agent, browsers } = lifecycleFixture();
    const hook = { finish: 'onFinish', error: 'onError', abort: 'onAbort' }[terminal];
    let callbackCount = 0;
    const stream = await agent.stream('stream page', { [hook]: async () => { callbackCount++; throw new Error('synthetic callback'); } });
    assert.equal(browsers[0].closed, 0);
    assert.equal(await stream.read(), 'stream page');
    await assert.rejects(stream[terminal](), /synthetic callback/);
    assert.equal(callbackCount, 1);
    assert.equal(browsers[0].closed, 1);
    await assert.rejects(stream.read(), /closed/);
  }
});

test('generation and stream setup failures release acquired browsers', async () => {
  const { agent, browsers } = lifecycleFixture();
  await assert.rejects(agent.generate('A', { fail: true }), /synthetic generation/);
  await assert.rejects(agent.stream('B', { fail: true }), /synthetic stream setup/);
  assert.deepEqual(browsers.map(browser => browser.closed), [1, 1]);
});
