import test from 'node:test';
import assert from 'node:assert/strict';
import { browserbase, Stagehand } from '@browserbasehq/stagehand';
import { RequestContext } from '@mastra/core/request-context';
import { webAgent } from '../src/mastra/agents/index.ts';

function model(url, afterTool) {
  return {
    specificationVersion: 'v2', provider: 'synthetic', modelId: 'lifecycle-test', supportedUrls: {},
    async doGenerate({ prompt }) {
      const done = prompt.some(message => message.role === 'tool');
      return {
        content: done ? [{ type: 'text', text: 'done' }] : [{ type: 'tool-call', toolCallId: 'call', toolName: 'stagehandActTool', input: JSON.stringify({ url, action: 'synthetic action' }) }],
        finishReason: done ? 'stop' : 'tool-calls',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, warnings: [],
      };
    },
    async doStream({ prompt }) {
      const done = prompt.some(message => message.role === 'tool');
      if (done) await afterTool?.();
      const parts = done ? [
        { type: 'text-start', id: 'text' },
        { type: 'text-delta', id: 'text', delta: 'done' },
        { type: 'text-end', id: 'text' },
      ] : [{ type: 'tool-call', toolCallId: 'call', toolName: 'stagehandActTool', input: JSON.stringify({ url, action: 'synthetic action' }) }];
      return { stream: new ReadableStream({ start(controller) {
        controller.enqueue({ type: 'stream-start', warnings: [] });
        for (const part of parts) controller.enqueue(part);
        controller.enqueue({ type: 'finish', finishReason: done ? 'stop' : 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } });
        controller.close();
      } }) };
    },
  };
}

test('actual Mastra isolates runs and closes on completion, provider error, abort and callback failure', async () => {
  const originalLaunch = browserbase.launch, originalCreate = Stagehand.create;
  const browsers = [], actions = [];
  browserbase.launch = async () => {
    const browser = { currentUrl: '', closed: 0, async close() { this.closed++; } };
    browser.context = { pages: async () => [{ async goto(url) { browser.currentUrl = url; await new Promise(resolve => setImmediate(resolve)); } }] };
    browsers.push(browser);
    return browser;
  };
  Stagehand.create = async ({ browser }) => ({
    browser, async close() {},
    async act() { actions.push(browser.currentUrl); return { data: { success: true, message: browser.currentUrl } }; },
  });
  try {
    const reused = new RequestContext();
    const results = await Promise.all([
      webAgent.generate('Synthetic A', { model: model('https://a.example/'), requestContext: reused, maxSteps: 3 }),
      webAgent.generate('Synthetic B', { model: model('https://b.example/'), requestContext: reused, maxSteps: 3 }),
    ]);
    assert.deepEqual(results.map(result => result.text), ['done', 'done']);
    assert.deepEqual(actions.sort(), ['https://a.example/', 'https://b.example/']);
    assert.deepEqual(browsers.map(browser => browser.closed), [1, 1]);
    const stream = await webAgent.stream('Synthetic stream', { model: model('https://stream.example/'), maxSteps: 3 });
    await stream.getFullOutput();
    assert.equal(actions.at(-1), 'https://stream.example/');
    assert.equal(browsers.length, 3);
    assert.deepEqual(browsers.map(browser => browser.closed), [1, 1, 1]);
    let errors = 0;
    const failed = await webAgent.stream('Synthetic error', {
      model: model('https://error.example/', () => { throw new Error('synthetic provider error'); }),
      maxSteps: 3, modelSettings: { maxRetries: 0 },
      onError: () => { errors++; },
    });
    await failed.getFullOutput().catch(() => {});
    assert.ok(errors > 0);
    assert.equal(browsers.length, 4);
    assert.equal(browsers[3].closed, 1);

    const controller = new AbortController();
    let aborted = 0;
    const cancelled = await webAgent.stream('Synthetic abort', {
      model: model('https://abort.example/', () => controller.abort()),
      maxSteps: 3, abortSignal: controller.signal,
      onAbort: () => { aborted++; },
    });
    await cancelled.getFullOutput().catch(() => {});
    assert.ok(aborted > 0);
    assert.equal(browsers.length, 5);
    assert.equal(browsers[4].closed, 1);
    let finishCalls = 0;
    const callbackFailure = await webAgent.stream('Synthetic callback failure', {
      model: model('https://callback.example/'), maxSteps: 3,
      onFinish: () => { finishCalls++; throw new Error('synthetic finish callback'); },
    });
    await callbackFailure.getFullOutput().catch(() => {});
    assert.ok(finishCalls > 0);
    assert.equal(browsers.length, 6);
    assert.equal(browsers[5].closed, 1);


  } finally {
    browserbase.launch = originalLaunch;
    Stagehand.create = originalCreate;
  }
});
