const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

test('retry after a save failure finishes the original session and context', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  const handlers = new Map();
  const calls = [];
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) {
      const classes = new Set(['hidden']);
      elements.set(id, {
        id,
        disabled: false,
        textContent: '',
        innerHTML: '',
        src: '',
        appendChild() {},
        classList: {
          add(value) { classes.add(value); },
          remove(value) { classes.delete(value); },
        },
        addEventListener(event, handler) { handlers.set(`${id}:${event}`, handler); },
      });
    }
    return elements.get(id);
  }
  let finishAttempts = 0;
  const context = {
    URL,
    console: { log() {} },
    document: {
      getElementById: element,
      createElement() { return element(`created-${elements.size}`); },
    },
    async fetch(url, options) {
      calls.push({ url, body: options.body && JSON.parse(options.body) });
      if (url === '/api/session') {
        return { ok: true, async json() { return {
          sessionId: 'session-1', contextId: 'context-1', finishToken: 'token-1',
          liveViewUrl: 'https://fixture.invalid/live', startUrl: 'https://platform-a.example.invalid/login',
        }; } };
      }
      finishAttempts++;
      if (finishAttempts === 1) return { ok: false, async json() { return { error: 'temporary save failure' }; } };
      return { ok: true, async json() { return { contextId: 'context-1' }; } };
    },
  };
  vm.runInNewContext(source, context);
  await handlers.get('start:click')();
  await handlers.get('done:click')();
  assert.equal(element('error-msg').textContent, 'temporary save failure');
  await handlers.get('retry:click')();
  assert.deepEqual(calls.map(call => call.url), ['/api/session', '/api/finish', '/api/finish']);
  assert.deepEqual(calls.at(-1).body, {
    sessionId: 'session-1', contextId: 'context-1', finishToken: 'token-1',
  });
  assert.equal(finishAttempts, 2);
});
