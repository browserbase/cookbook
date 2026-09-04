import assert from 'node:assert/strict';
import test from 'node:test';

import { createStagehandTools } from '../src/index.js';

test('LangChain tools call the Stagehand 4 result contract', async () => {
  const calls = [];
  const page = {
    async goto(url) { calls.push(['goto', url]); },
    url() { return 'https://example.com/result'; },
  };
  const stagehand = {
    async act(instruction) {
      calls.push(['act', instruction]);
      return { data: { success: true } };
    },
    async observe(instruction) {
      calls.push(['observe', instruction]);
      return { data: [{ description: 'Result link' }] };
    },
  };
  const { navigateTool, actionTool, observeTool } = createStagehandTools({ stagehand, page });
  assert.equal(await navigateTool.invoke({ url: 'https://example.com' }), 'https://example.com/result');
  assert.deepEqual(JSON.parse(await actionTool.invoke({ instruction: 'click' })), { success: true });
  assert.deepEqual(JSON.parse(await observeTool.invoke({ instruction: 'inspect' })), [
    { description: 'Result link' },
  ]);
  assert.deepEqual(calls, [
    ['goto', 'https://example.com'],
    ['act', 'click'],
    ['observe', 'inspect'],
  ]);
});

test('LangChain rejects an invalid URL before navigation', async () => {
  let navigated = false;
  const { navigateTool } = createStagehandTools({
    stagehand: {},
    page: { async goto() { navigated = true; } },
  });
  await assert.rejects(() => navigateTool.invoke({ url: 'invalid' }));
  assert.equal(navigated, false);
});
